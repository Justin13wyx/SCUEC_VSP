CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title STRING NOT NULL,
  selections STRING NOT NULL,
  answer STRING NOT NULL,
  score INTEGER DEFAULT 10,
  active BOOLEAN DEFAULT 1
);
CREATE TABLE IF NOT EXISTS selections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content STRING NOT NULL
);
INSERT INTO questions (title, selections, answer) VALUES ("This is a sample questions", "1,2,3", "2");
INSERT INTO selections (content) VALUES ("selection A");
INSERT INTO selections (content) VALUES ("selection B");
INSERT INTO selections (content) VALUES ("selection C");