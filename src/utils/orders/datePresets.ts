/**
 * Date preset helper functions for order filtering
 */

export const getCurrentWeekRange = () => {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // If Sunday, go back 6 days; otherwise go to Monday
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  
  const endDate = new Date(today);
  endDate.setHours(23, 59, 59, 999);
  
  return {
    from: monday.toISOString().split('T')[0],
    to: endDate.toISOString().split('T')[0],
  };
};

export const getLastWeekRange = () => {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const lastMonday = new Date(today);
  lastMonday.setDate(today.getDate() + diff - 7);
  lastMonday.setHours(0, 0, 0, 0);
  
  const lastSunday = new Date(lastMonday);
  lastSunday.setDate(lastMonday.getDate() + 6);
  lastSunday.setHours(23, 59, 59, 999);
  
  return {
    from: lastMonday.toISOString().split('T')[0],
    to: lastSunday.toISOString().split('T')[0],
  };
};

export const getCurrentMonthRange = () => {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  firstDay.setHours(0, 0, 0, 0);
  
  const endDate = new Date(today);
  endDate.setHours(23, 59, 59, 999);
  
  return {
    from: firstDay.toISOString().split('T')[0],
    to: endDate.toISOString().split('T')[0],
  };
};

export const getLastMonthRange = () => {
  const today = new Date();
  const firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  firstDayLastMonth.setHours(0, 0, 0, 0);
  
  const lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
  lastDayLastMonth.setHours(23, 59, 59, 999);
  
  return {
    from: firstDayLastMonth.toISOString().split('T')[0],
    to: lastDayLastMonth.toISOString().split('T')[0],
  };
};

