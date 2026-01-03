import { db } from "../db.js";

export const listTags = (_req, res, next) => {
  try {
    const tags = db.prepare("SELECT * FROM tags ORDER BY name ASC;").all();
    res.json(tags);
  } catch (error) {
    next(error);
  }
};

export const createTag = (req, res, next) => {
  try {
    const { name, color } = req.body;
    if (!name || !color) {
      return res.status(400).json({ message: "Name and color are required" });
    }
    const stmt = db.prepare(
      `INSERT INTO tags (name, color) VALUES (@name, @color);`
    );
    const result = stmt.run({ name, color });
    const newTag = db.prepare("SELECT * FROM tags WHERE id = ?;").get(result.lastInsertRowid);
    res.status(201).json(newTag);
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ message: "Tag name already exists" });
    }
    next(error);
  }
};

export const updateTag = (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, color } = req.body;
    if (!name || !color) {
      return res.status(400).json({ message: "Name and color are required" });
    }
    const stmt = db.prepare(
      `UPDATE tags SET name = @name, color = @color WHERE id = @id;`
    );
    const result = stmt.run({ id, name, color });
    if (result.changes === 0) {
      return res.status(404).json({ message: "Tag not found" });
    }
    const updatedTag = db.prepare("SELECT * FROM tags WHERE id = ?;").get(id);
    res.json(updatedTag);
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ message: "Tag name already exists" });
    }
    next(error);
  }
};

export const deleteTag = (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if tag exists
    const tag = db.prepare("SELECT * FROM tags WHERE id = ?;").get(id);
    if (!tag) {
      return res.status(404).json({ message: "Tag not found" });
    }

    // Count how many items have this tag (for informational purposes, but we'll still delete)
    const orderCount = db.prepare("SELECT COUNT(*) as count FROM order_tag_assignments WHERE tagId = ?;").get(id);
    const transferCount = db.prepare("SELECT COUNT(*) as count FROM transfer_tag_assignments WHERE tagId = ?;").get(id);
    const expenseCount = db.prepare("SELECT COUNT(*) as count FROM expense_tag_assignments WHERE tagId = ?;").get(id);
    const totalCount = (orderCount?.count || 0) + (transferCount?.count || 0) + (expenseCount?.count || 0);

    // Delete the tag - CASCADE DELETE will automatically remove all assignments
    const stmt = db.prepare(`DELETE FROM tags WHERE id = ?;`);
    const result = stmt.run(id);
    
    if (result.changes === 0) {
      return res.status(404).json({ message: "Tag not found" });
    }
    
    // Return success with info about how many assignments were removed
    res.json({ 
      success: true,
      message: totalCount > 0 
        ? `Tag deleted. Removed from ${totalCount} item(s).`
        : "Tag deleted successfully."
    });
  } catch (error) {
    next(error);
  }
};

// Batch tag assignment endpoint
export const batchAssignTags = (req, res, next) => {
  try {
    const { entityType, entityIds, tagIds } = req.body;
    
    console.log('batchAssignTags called with:', { entityType, entityIds, tagIds });
    
    if (!entityType || !Array.isArray(entityIds) || !Array.isArray(tagIds)) {
      return res.status(400).json({ message: "entityType, entityIds, and tagIds are required" });
    }

    if (!['order', 'transfer', 'expense'].includes(entityType)) {
      return res.status(400).json({ message: "entityType must be 'order', 'transfer', or 'expense'" });
    }

    if (entityIds.length === 0) {
      return res.status(400).json({ message: "At least one entity ID is required" });
    }

    if (tagIds.length === 0) {
      return res.status(400).json({ message: "At least one tag ID is required" });
    }

    // Determine which assignment table to use
    const tableName = `${entityType}_tag_assignments`;
    const entityIdColumn = entityType === 'order' ? 'orderId' : entityType === 'transfer' ? 'transferId' : 'expenseId';

    // Validate and convert entityIds and tagIds to numbers
    const validEntityIds = entityIds
      .map(id => {
        const num = typeof id === 'string' ? parseInt(id, 10) : Number(id);
        return isNaN(num) ? null : num;
      })
      .filter(id => id !== null && id > 0);
    
    const validTagIds = tagIds
      .map(id => {
        const num = typeof id === 'string' ? parseInt(id, 10) : Number(id);
        return isNaN(num) ? null : num;
      })
      .filter(id => id !== null && id > 0);

    console.log('Validated IDs:', { validEntityIds, validTagIds, types: { entity: typeof validEntityIds[0], tag: typeof validTagIds[0] } });

    if (validEntityIds.length === 0) {
      return res.status(400).json({ message: "No valid entity IDs provided" });
    }

    if (validTagIds.length === 0) {
      return res.status(400).json({ message: "No valid tag IDs provided" });
    }

    // Validate that all tags exist
    try {
      if (validTagIds.length === 1) {
        const existingTag = db.prepare('SELECT id FROM tags WHERE id = ?').get(validTagIds[0]);
        console.log(`Validating tag ID ${validTagIds[0]}:`, existingTag ? 'EXISTS' : 'NOT FOUND');
        if (!existingTag) {
          return res.status(400).json({ 
            message: `Tag ID ${validTagIds[0]} does not exist` 
          });
        }
      } else {
        const tagPlaceholders = validTagIds.map(() => '?').join(',');
        const tagQuery = db.prepare(`SELECT id FROM tags WHERE id IN (${tagPlaceholders})`);
        const existingTags = tagQuery.all(...validTagIds);
        console.log(`Validating tag IDs ${validTagIds.join(', ')}: Found ${existingTags.length} of ${validTagIds.length}`);
        const existingTagIds = new Set(existingTags.map(t => t.id));
        const missingTagIds = validTagIds.filter(id => !existingTagIds.has(id));
        if (missingTagIds.length > 0) {
          console.log(`Missing tag IDs: ${missingTagIds.join(', ')}`);
          return res.status(400).json({ 
            message: `The following tag IDs do not exist: ${missingTagIds.join(', ')}` 
          });
        }
      }
    } catch (err) {
      console.error('Error validating tags:', err);
      return res.status(400).json({ 
        message: `Error validating tag IDs: ${err.message}` 
      });
    }

    // Validate that all entities exist
    try {
      const entityTable = entityType === 'order' ? 'orders' : entityType === 'transfer' ? 'internal_transfers' : 'expenses';
      if (validEntityIds.length === 1) {
        const entityIdNum = Number(validEntityIds[0]);
        const entityQuery = db.prepare(`SELECT id FROM ${entityTable} WHERE id = ?`);
        const existingEntity = entityQuery.get(entityIdNum);
        console.log(`Validating ${entityType} ID ${entityIdNum} (type: ${typeof entityIdNum}) from table ${entityTable}:`, existingEntity ? `EXISTS (id: ${existingEntity.id}, type: ${typeof existingEntity.id})` : 'NOT FOUND');
        if (!existingEntity) {
          return res.status(400).json({ 
            message: `${entityType} ID ${validEntityIds[0]} does not exist` 
          });
        }
      } else {
        const entityPlaceholders = validEntityIds.map(() => '?').join(',');
        const entityQuery = db.prepare(`SELECT id FROM ${entityTable} WHERE id IN (${entityPlaceholders})`);
        const existingEntities = entityQuery.all(...validEntityIds);
        console.log(`Validating ${entityType} IDs ${validEntityIds.join(', ')} from table ${entityTable}: Found ${existingEntities.length} of ${validEntityIds.length}`);
        const existingEntityIds = new Set(existingEntities.map(e => e.id));
        const missingEntityIds = validEntityIds.filter(id => !existingEntityIds.has(id));
        if (missingEntityIds.length > 0) {
          console.log(`Missing ${entityType} IDs: ${missingEntityIds.join(', ')}`);
          return res.status(400).json({ 
            message: `The following ${entityType} IDs do not exist: ${missingEntityIds.join(', ')}` 
          });
        }
      }
    } catch (err) {
      console.error('Error validating entities:', err);
      return res.status(400).json({ 
        message: `Error validating ${entityType} IDs: ${err.message}` 
      });
    }

    // Double-check that the IDs actually exist right before insertion
    // This helps catch any race conditions or validation issues
    for (const entityId of validEntityIds) {
      const entityIdNum = Number(entityId);
      const entityTable = entityType === 'order' ? 'orders' : entityType === 'transfer' ? 'internal_transfers' : 'expenses';
      const check = db.prepare(`SELECT id FROM ${entityTable} WHERE id = ?`).get(entityIdNum);
      if (!check) {
        console.error(`CRITICAL: ${entityType} ID ${entityIdNum} not found in ${entityTable} right before insert!`);
        return res.status(400).json({ 
          message: `${entityType} ID ${entityIdNum} does not exist in database` 
        });
      }
      console.log(`Pre-insert check: ${entityType} ID ${entityIdNum} confirmed in ${entityTable}`);
    }
    
    for (const tagId of validTagIds) {
      const tagIdNum = Number(tagId);
      const check = db.prepare('SELECT id FROM tags WHERE id = ?').get(tagIdNum);
      if (!check) {
        console.error(`CRITICAL: Tag ID ${tagIdNum} not found in tags right before insert!`);
        return res.status(400).json({ 
          message: `Tag ID ${tagIdNum} does not exist in database` 
        });
      }
      console.log(`Pre-insert check: Tag ID ${tagIdNum} confirmed in tags`);
    }

    // Use a transaction to ensure all assignments succeed or fail together
    // IMPORTANT: Statement must be prepared INSIDE the transaction in better-sqlite3
    const assignTags = db.transaction((entities, tags) => {
      const stmt = db.prepare(
        `INSERT OR IGNORE INTO ${tableName} (${entityIdColumn}, tagId) VALUES (?, ?);`
      );
      
      let insertedCount = 0;
      for (const entityId of entities) {
        for (const tagId of tags) {
          try {
            // Ensure IDs are integers (SQLite foreign keys are strict about types)
            const entityIdInt = Number(entityId);
            const tagIdInt = Number(tagId);
            console.log(`Attempting to insert: ${entityIdColumn}=${entityIdInt} (type: ${typeof entityIdInt}), tagId=${tagIdInt} (type: ${typeof tagIdInt}) into ${tableName}`);
            const result = stmt.run(entityIdInt, tagIdInt);
            // result.changes tells us if a row was inserted (1) or ignored due to duplicate (0)
            if (result.changes > 0) {
              insertedCount++;
              console.log(`Successfully inserted assignment: ${entityIdColumn}=${entityId}, tagId=${tagId}`);
            } else {
              console.log(`Assignment already exists (ignored): ${entityIdColumn}=${entityId}, tagId=${tagId}`);
            }
          } catch (err) {
            console.error(`Error inserting tag assignment ${entityIdColumn}=${entityId}, tagId=${tagId}:`, err);
            console.error('Error code:', err.code);
            console.error('Error message:', err.message);
            // Provide a more specific error message
            if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
              throw new Error(`Foreign key constraint violation: ${entityType} ID ${entityId} or tag ID ${tagId} does not exist`);
            }
            throw err; // Re-throw to rollback transaction
          }
        }
      }
      return insertedCount;
    });

    try {
      const insertedCount = assignTags(validEntityIds, validTagIds);
      console.log(`Successfully inserted ${insertedCount} tag assignments`);

      res.json({ 
        success: true, 
        message: `Tags assigned to ${validEntityIds.length} ${entityType}(s). ${insertedCount} new assignment(s) created.` 
      });
    } catch (transactionError) {
      console.error('Transaction error in batchAssignTags:', transactionError);
      // If it's already a user-friendly error, pass it through
      if (transactionError.message && transactionError.message.includes('Foreign key constraint violation')) {
        return res.status(400).json({ 
          message: transactionError.message 
        });
      }
      throw transactionError; // Re-throw to be caught by outer catch
    }
  } catch (error) {
    console.error('Error in batchAssignTags:', error);
    next(error);
  }
};

// Batch tag unassignment endpoint
export const batchUnassignTags = (req, res, next) => {
  try {
    const { entityType, entityIds, tagIds } = req.body;

    if (!entityType || !Array.isArray(entityIds) || !Array.isArray(tagIds)) {
      return res.status(400).json({ message: "entityType, entityIds, and tagIds are required" });
    }

    if (!["order", "transfer", "expense"].includes(entityType)) {
      return res.status(400).json({ message: "entityType must be 'order', 'transfer', or 'expense'" });
    }

    if (entityIds.length === 0) {
      return res.status(400).json({ message: "At least one entity ID is required" });
    }

    if (tagIds.length === 0) {
      return res.status(400).json({ message: "At least one tag ID is required" });
    }

    const tableName = `${entityType}_tag_assignments`;
    const entityIdColumn = entityType === "order" ? "orderId" : entityType === "transfer" ? "transferId" : "expenseId";

    // Ensure IDs are numeric
    const toNums = (arr) =>
      arr
        .map((id) => (typeof id === "string" ? parseInt(id, 10) : Number(id)))
        .filter((id) => !isNaN(id) && id > 0);

    const validEntityIds = toNums(entityIds);
    const validTagIds = toNums(tagIds);

    if (validEntityIds.length === 0 || validTagIds.length === 0) {
      return res.status(400).json({ message: "No valid IDs provided" });
    }

    // Simple delete; foreign key constraints already ensure IDs exist
    const unassign = db.transaction((entities, tags) => {
      const stmt = db.prepare(
        `DELETE FROM ${tableName} WHERE ${entityIdColumn} = ? AND tagId = ?;`
      );
      let deleted = 0;
      for (const entityId of entities) {
        for (const tagId of tags) {
          const result = stmt.run(Number(entityId), Number(tagId));
          deleted += result.changes || 0;
        }
      }
      return deleted;
    });

    const removedCount = unassign(validEntityIds, validTagIds);

    return res.json({
      success: true,
      message: `Removed ${removedCount} assignment(s).`,
    });
  } catch (error) {
    console.error("Error in batchUnassignTags:", error);
    next(error);
  }
};

