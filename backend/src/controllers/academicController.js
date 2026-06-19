const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');

// ===================== LABELS =====================
const getLabels = async (req, res) => {
  const [rows] = await db.query(
    `SELECT * FROM academic_structure_labels WHERE institution_id = ? AND status = 'active' LIMIT 1`,
    [req.user.institution_id]
  );
  res.json(rows[0] || null);
};

const upsertLabels = async (req, res) => {
  const { category_label, subcategory_label, item_label } = req.body;
  const instId = req.user.institution_id;
  try {
    const [existing] = await db.query(
      `SELECT id FROM academic_structure_labels WHERE institution_id = ? AND status = 'active'`,
      [instId]
    );
    if (existing.length) {
      await db.query(
        `UPDATE academic_structure_labels SET category_label=?, subcategory_label=?, item_label=? WHERE id=?`,
        [category_label, subcategory_label, item_label, existing[0].id]
      );
    } else {
      await db.query(
        `INSERT INTO academic_structure_labels (id, institution_id, category_label, subcategory_label, item_label) VALUES (?, ?, ?, ?, ?)`,
        [uuidv4(), instId, category_label, subcategory_label, item_label]
      );
    }
    res.json({ message: 'Labels saved' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save labels' });
  }
};

// ===================== CATEGORIES =====================
const getCategories = async (req, res) => {
  const { academic_year } = req.query;
  let sql = `SELECT * FROM academic_category WHERE institution_id = ?`;
  const params = [req.user.institution_id];
  if (academic_year) { sql += ` AND academic_year = ?`; params.push(academic_year); }
  sql += ` ORDER BY name`;
  const [rows] = await db.query(sql, params);
  res.json(rows);
};

const createCategory = async (req, res) => {
  const { name, academic_year, status } = req.body;
  if (!name || !academic_year) return res.status(400).json({ error: 'name and academic_year required' });
  try {
    const id = uuidv4();
    await db.query(
      `INSERT INTO academic_category (id, institution_id, name, academic_year, status) VALUES (?, ?, ?, ?, ?)`,
      [id, req.user.institution_id, name, academic_year, status || 'active']
    );
    const [rows] = await db.query('SELECT * FROM academic_category WHERE id = ?', [id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Category already exists for this year' });
    res.status(500).json({ error: 'Failed to create category' });
  }
};

const updateCategory = async (req, res) => {
  const { name, academic_year, status, is_locked } = req.body;
  await db.query(
    `UPDATE academic_category SET name=?, academic_year=?, status=?, is_locked=? WHERE id=? AND institution_id=?`,
    [name, academic_year, status, is_locked, req.params.id, req.user.institution_id]
  );
  res.json({ message: 'Category updated' });
};

const deleteCategory = async (req, res) => {
  const [children] = await db.query('SELECT id FROM academic_subcategory WHERE category_id = ? LIMIT 1', [req.params.id]);
  if (children.length) return res.status(400).json({ error: 'Cannot delete category with existing subcategories' });
  await db.query('DELETE FROM academic_category WHERE id = ? AND institution_id = ?', [req.params.id, req.user.institution_id]);
  res.json({ message: 'Category deleted' });
};

// ===================== SUBCATEGORIES =====================
const getSubcategories = async (req, res) => {
  const { category_id } = req.query;
  let sql = `SELECT s.* FROM academic_subcategory s JOIN academic_category c ON c.id = s.category_id WHERE c.institution_id = ?`;
  const params = [req.user.institution_id];
  if (category_id) { sql += ` AND s.category_id = ?`; params.push(category_id); }
  sql += ` ORDER BY s.name`;
  const [rows] = await db.query(sql, params);
  res.json(rows);
};

const createSubcategory = async (req, res) => {
  const { category_id, name, status } = req.body;
  if (!category_id || !name) return res.status(400).json({ error: 'category_id and name required' });
  try {
    const id = uuidv4();
    await db.query(`INSERT INTO academic_subcategory (id, category_id, name, status) VALUES (?, ?, ?, ?)`, [id, category_id, name, status || 'active']);
    const [rows] = await db.query('SELECT * FROM academic_subcategory WHERE id = ?', [id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Subcategory already exists' });
    res.status(500).json({ error: 'Failed to create subcategory' });
  }
};

const updateSubcategory = async (req, res) => {
  const { name, status } = req.body;
  await db.query(`UPDATE academic_subcategory SET name=?, status=? WHERE id=?`, [name, status, req.params.id]);
  res.json({ message: 'Subcategory updated' });
};

const deleteSubcategory = async (req, res) => {
  const [children] = await db.query('SELECT id FROM academic_item WHERE subcategory_id = ? LIMIT 1', [req.params.id]);
  if (children.length) return res.status(400).json({ error: 'Cannot delete subcategory with existing items' });
  await db.query('DELETE FROM academic_subcategory WHERE id = ?', [req.params.id]);
  res.json({ message: 'Subcategory deleted' });
};

// ===================== ITEMS =====================
const getItems = async (req, res) => {
  const { subcategory_id } = req.query;
  let sql = `SELECT i.* FROM academic_item i 
             JOIN academic_subcategory s ON s.id = i.subcategory_id
             JOIN academic_category c ON c.id = s.category_id
             WHERE c.institution_id = ?`;
  const params = [req.user.institution_id];
  if (subcategory_id) { sql += ` AND i.subcategory_id = ?`; params.push(subcategory_id); }
  sql += ` ORDER BY i.name`;
  const [rows] = await db.query(sql, params);
  res.json(rows);
};

const createItem = async (req, res) => {
  const { subcategory_id, name, capacity, status } = req.body;
  if (!subcategory_id || !name) return res.status(400).json({ error: 'subcategory_id and name required' });
  try {
    const id = uuidv4();
    await db.query(`INSERT INTO academic_item (id, subcategory_id, name, capacity, status) VALUES (?, ?, ?, ?, ?)`, [id, subcategory_id, name, capacity, status || 'active']);
    const [rows] = await db.query('SELECT * FROM academic_item WHERE id = ?', [id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Item already exists' });
    res.status(500).json({ error: 'Failed to create item' });
  }
};

const updateItem = async (req, res) => {
  const { name, capacity, status } = req.body;
  await db.query(`UPDATE academic_item SET name=?, capacity=?, status=? WHERE id=?`, [name, capacity, status, req.params.id]);
  res.json({ message: 'Item updated' });
};

const deleteItem = async (req, res) => {
  await db.query('DELETE FROM academic_item WHERE id = ?', [req.params.id]);
  res.json({ message: 'Item deleted' });
};

// ===================== COPY STRUCTURE =====================
const copyAcademicStructure = async (req, res) => {
  const { from_year, to_year } = req.body;
  if (!from_year || !to_year) return res.status(400).json({ error: 'from_year and to_year required' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const instId = req.user.institution_id;
    let copiedCount = 0;

    const [categories] = await conn.query(
      `SELECT * FROM academic_category WHERE institution_id = ? AND academic_year = ?`, [instId, from_year]
    );

    for (const cat of categories) {
      const newCatId = uuidv4();
      await conn.query(
        `INSERT INTO academic_category (id, institution_id, name, academic_year, status, is_locked) VALUES (?, ?, ?, ?, ?, false)`,
        [newCatId, instId, cat.name, to_year, cat.status]
      );
      copiedCount++;

      const [subcats] = await conn.query(`SELECT * FROM academic_subcategory WHERE category_id = ?`, [cat.id]);
      for (const sub of subcats) {
        const newSubId = uuidv4();
        await conn.query(
          `INSERT INTO academic_subcategory (id, category_id, name, status) VALUES (?, ?, ?, ?)`,
          [newSubId, newCatId, sub.name, sub.status]
        );
        copiedCount++;

        const [items] = await conn.query(`SELECT * FROM academic_item WHERE subcategory_id = ?`, [sub.id]);
        for (const item of items) {
          await conn.query(
            `INSERT INTO academic_item (id, subcategory_id, name, capacity, status) VALUES (?, ?, ?, ?, ?)`,
            [uuidv4(), newSubId, item.name, item.capacity, item.status]
          );
          copiedCount++;
        }
      }
    }

    await conn.commit();
    res.json({ success: true, copied_count: copiedCount, from_year, to_year });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: 'Copy failed: ' + err.message });
  } finally {
    conn.release();
  }
};

module.exports = {
  getLabels, upsertLabels,
  getCategories, createCategory, updateCategory, deleteCategory,
  getSubcategories, createSubcategory, updateSubcategory, deleteSubcategory,
  getItems, createItem, updateItem, deleteItem,
  copyAcademicStructure
};
