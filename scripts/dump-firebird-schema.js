const Firebird = require('node-firebird');
const fs = require('fs');
const path = require('path');

const dbPath = process.argv[2];
if (!dbPath) {
  console.error('Usage: node scripts/dump-firebird-schema.js <path-to-books.fdb>');
  process.exit(1);
}

const options = {
  host: process.env.FB_HOST || 'localhost',
  port: Number(process.env.FB_PORT || 3050),
  database: dbPath,
  user: process.env.FB_USER || 'SYSDBA',
  password: process.env.FB_PASSWORD || 'masterkey',
  lowercase_keys: true,
};

const sql = `
SELECT
  TRIM(r.RDB$RELATION_NAME) AS table_name,
  TRIM(rf.RDB$FIELD_NAME) AS column_name,
  f.RDB$FIELD_TYPE AS field_type,
  f.RDB$FIELD_SUB_TYPE AS field_sub_type,
  f.RDB$FIELD_LENGTH AS field_length,
  f.RDB$FIELD_PRECISION AS field_precision,
  f.RDB$FIELD_SCALE AS field_scale,
  rf.RDB$NULL_FLAG AS not_null,
  TRIM(COALESCE(c.RDB$CONSTRAINT_NAME, '')) AS pk_name
FROM RDB$RELATION_FIELDS rf
JOIN RDB$RELATIONS r ON r.RDB$RELATION_NAME = rf.RDB$RELATION_NAME
JOIN RDB$FIELDS f ON f.RDB$FIELD_NAME = rf.RDB$FIELD_SOURCE
LEFT JOIN RDB$INDEX_SEGMENTS s
  ON s.RDB$FIELD_NAME = rf.RDB$FIELD_NAME
  AND s.RDB$RELATION_NAME = rf.RDB$RELATION_NAME
LEFT JOIN RDB$RELATION_CONSTRAINTS c
  ON c.RDB$INDEX_NAME = s.RDB$INDEX_NAME
  AND c.RDB$CONSTRAINT_TYPE = 'PRIMARY KEY'
WHERE COALESCE(r.RDB$SYSTEM_FLAG, 0) = 0
ORDER BY table_name, rf.RDB$FIELD_POSITION;
`;

function fbTypeName(fieldType, subType) {
  const t = Number(fieldType);
  const st = Number(subType || 0);
  if (t === 7) return st > 0 ? 'NUMERIC/DECIMAL(SHORT)' : 'SMALLINT';
  if (t === 8) return st > 0 ? 'NUMERIC/DECIMAL(LONG)' : 'INTEGER';
  if (t === 10) return 'FLOAT';
  if (t === 12) return 'DATE';
  if (t === 13) return 'TIME';
  if (t === 14) return 'CHAR';
  if (t === 16) return st > 0 ? 'NUMERIC/DECIMAL(INT64)' : 'BIGINT';
  if (t === 27) return 'DOUBLE';
  if (t === 35) return 'TIMESTAMP';
  if (t === 37) return 'VARCHAR';
  if (t === 261) return 'BLOB';
  return `TYPE_${t}`;
}

Firebird.attach(options, (err, db) => {
  if (err) {
    console.error('Attach failed:', err.message);
    process.exit(2);
  }

  db.query(sql, [], (qErr, rows) => {
    db.detach();

    if (qErr) {
      console.error('Query failed:', qErr.message);
      process.exit(3);
    }

    const grouped = new Map();
    for (const row of rows) {
      const table = row.table_name;
      if (!grouped.has(table)) grouped.set(table, []);
      grouped.get(table).push({
        column: row.column_name,
        type: fbTypeName(row.field_type, row.field_sub_type),
        len: row.field_length,
        precision: row.field_precision,
        scale: row.field_scale,
        notNull: row.not_null === 1,
        isPk: row.pk_name.length > 0,
      });
    }

    const output = {
      database: dbPath,
      tableCount: grouped.size,
      tables: Object.fromEntries(grouped),
    };

    const outDir = path.join(process.cwd(), 'schema-output');
    fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, `${path.basename(dbPath)}.schema.json`);
    fs.writeFileSync(outFile, JSON.stringify(output, null, 2));

    console.log(`Tables: ${grouped.size}`);
    console.log(`Schema file: ${outFile}`);
    console.log('Sample tables:');
    Array.from(grouped.keys()).slice(0, 20).forEach((t) => console.log(`- ${t}`));
  });
});
