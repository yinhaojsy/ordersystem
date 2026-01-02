import { db } from "../db.js";

// Store active SSE connections by role name: Map<roleName, Set<res>>
const sseConnections = new Map();

// Broadcast logout message to all users with a specific role
export const broadcastLogout = (roleName) => {
  const connections = sseConnections.get(roleName);
  if (connections && connections.size > 0) {
    const message = JSON.stringify({ type: 'forceLogout', timestamp: Date.now() });
    connections.forEach((res) => {
      try {
        res.write(`data: ${message}\n\n`);
      } catch (error) {
        // Connection closed, remove it
        connections.delete(res);
      }
    });
  }
};

// SSE endpoint for role updates subscription
export const subscribeToRoleUpdates = (req, res, next) => {
  try {
    const { roleName } = req.query;
    if (!roleName) {
      return res.status(400).json({ message: "Role name is required" });
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Store this connection
    if (!sseConnections.has(roleName)) {
      sseConnections.set(roleName, new Set());
    }
    sseConnections.get(roleName).add(res);

    // Send initial connection confirmation
    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

    // Send periodic heartbeat to keep connection alive (every 30 seconds)
    const heartbeatInterval = setInterval(() => {
      try {
        res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: Date.now() })}\n\n`);
      } catch (error) {
        // Connection closed, stop heartbeat
        clearInterval(heartbeatInterval);
      }
    }, 30000);

    // Handle client disconnect
    req.on('close', () => {
      clearInterval(heartbeatInterval);
      const connections = sseConnections.get(roleName);
      if (connections) {
        connections.delete(res);
        if (connections.size === 0) {
          sseConnections.delete(roleName);
        }
      }
    });

    // Handle request timeout (5 minutes)
    req.setTimeout(300000, () => {
      clearInterval(heartbeatInterval);
      const connections = sseConnections.get(roleName);
      if (connections) {
        connections.delete(res);
        if (connections.size === 0) {
          sseConnections.delete(roleName);
        }
      }
      try {
        res.end();
      } catch (error) {
        // Connection already closed
      }
    });
  } catch (error) {
    next(error);
  }
};

export const listRoles = (_req, res) => {
  const rows = db.prepare("SELECT * FROM roles ORDER BY id ASC;").all();
  const parsed = rows.map((row) => ({
    ...row,
    permissions: JSON.parse(row.permissions),
  }));
  res.json(parsed);
};

export const createRole = (req, res, next) => {
  try {
    const payload = req.body || {};
    const stmt = db.prepare(
      `INSERT INTO roles (name, displayName, permissions)
       VALUES (@name, @displayName, @permissions);`,
    );
    const result = stmt.run({
      ...payload,
      permissions: JSON.stringify(payload.permissions || { sections: [], actions: {} }),
    });
    const row = db.prepare("SELECT * FROM roles WHERE id = ?;").get(result.lastInsertRowid);
    res
      .status(201)
      .json({ ...row, permissions: JSON.parse(row.permissions || "{}") });
  } catch (error) {
    next(error);
  }
};

export const updateRole = (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body || {};
    const fields = Object.keys(updates);
    if (!fields.length) {
      return res.status(400).json({ message: "No updates provided" });
    }
    const assignments = fields.map((field) => `${field} = @${field}`).join(", ");
    // Always update the updatedAt timestamp when role is modified
    const updatedAt = new Date().toISOString();
    db.prepare(`UPDATE roles SET ${assignments}, updatedAt = @updatedAt WHERE id = @id;`).run({
      ...updates,
      permissions: updates.permissions
        ? JSON.stringify(updates.permissions)
        : undefined,
      updatedAt,
      id,
    });
    const row = db.prepare("SELECT * FROM roles WHERE id = ?;").get(id);
    res.json({ ...row, permissions: JSON.parse(row.permissions || "{}") });
  } catch (error) {
    next(error);
  }
};

export const deleteRole = (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if role exists
    const role = db.prepare("SELECT id, name, displayName FROM roles WHERE id = ?;").get(id);
    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }
    
    // Check if any users are assigned to this role
    const usersWithRole = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = ?;").get(role.name);
    if (usersWithRole && usersWithRole.count > 0) {
      return res.status(400).json({ 
        message: `Cannot delete role "${role.displayName}" because it is assigned to ${usersWithRole.count} user(s). Please reassign or remove those users first.` 
      });
    }
    
    // Safe to delete - no users are using this role
    const stmt = db.prepare("DELETE FROM roles WHERE id = ?;");
    const result = stmt.run(id);
    if (result.changes === 0) {
      return res.status(404).json({ message: "Role not found" });
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const forceLogoutUsersByRole = (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if role exists
    const role = db.prepare("SELECT id, name, displayName FROM roles WHERE id = ?;").get(id);
    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }
    
    // Update the role's updatedAt timestamp
    const updatedAt = new Date().toISOString();
    db.prepare("UPDATE roles SET updatedAt = ? WHERE id = ?;").run(updatedAt, id);
    
    // Broadcast logout to all connected clients with this role
    broadcastLogout(role.name);
    
    // Get count of users with this role
    const usersWithRole = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = ?;").get(role.name);
    
    res.json({ 
      success: true,
      message: `All users with role "${role.displayName}" will be logged out immediately.`,
      userCount: usersWithRole.count
    });
  } catch (error) {
    next(error);
  }
};


