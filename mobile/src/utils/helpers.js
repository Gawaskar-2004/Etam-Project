// ==================== HELPERS ====================
export const todayStr = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

export const monthStr = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export const hasFaceRegistered = (student) => {
  if (!student) return false;
  return !!(
    student.face_descriptor &&
    student.face_descriptor !== 'null' &&
    student.face_descriptor !== null &&
    typeof student.face_descriptor === 'string' &&
    student.face_descriptor.length > 100
  );
};

export const getClassName = (item) => {
  if (!item) return 'Class';
  if (item.category_name && item.subcategory_name && item.item_name)
    return `${item.category_name} ${item.subcategory_name} ${item.item_name}`;
  if (item.subcategory_name && item.item_name) return `${item.subcategory_name} ${item.item_name}`;
  if (item.subcategory_name) return item.subcategory_name;
  if (item.item_name) return `Section ${item.item_name}`;
  return item.class_name || 'Class';
};

// Format MySQL TIME "HH:MM:SS" or "HH:MM" to "8:00 AM" style
export const formatTime = (t) => {
  if (!t) return null;
  const parts = String(t).split(':');
  let h = parseInt(parts[0], 10);
  const m = parts[1] || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
};

export const buildClassMap = (list) => {
  if (!Array.isArray(list)) return [];
  const map = new Map();
  list.forEach(item => {
    const key = `${item.subcategory_id || 'none'}_${item.item_id || 'none'}`;
    if (!map.has(key)) {
      map.set(key, {
        id: key,
        name: getClassName(item),
        subcategory_id: item.subcategory_id,
        item_id: item.item_id,
        category_id: item.category_id,
      });
    }
  });
  return Array.from(map.values());
};
