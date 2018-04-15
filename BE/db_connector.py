import sqlite3
from hashlib import md5

CORRECT = 0
INCORRECT = 1
NONEXIST = 2
DEACTIVED = 3

IntegrityError = sqlite3.IntegrityError
OperationalError = sqlite3.OperationalError

get_sql = "SELECT {} FROM {} WHERE {}"
set_sql = "INSERT INTO {} {} VALUES {}"
del_sql = "DELETE FROM {} WHERE {}"
update_sql = "UPDATE {} SET {} WHERE {}"


class DBConnector:

    def __init__(self, db):
        self.conn = sqlite3.connect(db, check_same_thread=False)
        self.cursor = self.conn.cursor()

    def get_all(self, table):
        sql = "SELECT * FROM {}".format(str(table))
        try:
            result_cursor = self.cursor.execute(sql)
        except (sqlite3.IntegrityError, sqlite3.OperationalError) as e:
            print(sql)
            print(e)
            return False
        return result_cursor

    def get_attr(self, table, keyword, value, fields):
        condition = "{}='{}'".format(str(keyword), str(value))
        sql = get_sql.format(trim_comma(fields).replace("\'", "")[1:-1], str(table), condition)
        try:
            result_cursor = self.cursor.execute(sql)
        except (sqlite3.IntegrityError, sqlite3.OperationalError) as e:
            print(sql)
            print(e)
            return False
        return result_cursor

    def set_attr(self, table, keywords, attributes):
        sql = set_sql.format(str(table), trim_comma(keywords).replace("\'", ""), trim_comma(attributes))
        try:
            self.cursor.execute(sql)
            self.conn.commit()
        except (sqlite3.IntegrityError, sqlite3.OperationalError) as e:
            print(sql)
            print(e)
            return False
        return True

    def remove_attr(self, table, keyword, value, commit=False):
        condition = "{}='{}'".format(keyword, value)
        sql = del_sql.format(table, condition)
        self.cursor.execute(sql)
        if commit:
            self.conn.commit()

    def update_attr(self, table, keyword, value, kwargs):
        condition = "{}='{}'".format(keyword, value)
        values = []
        for k, v in kwargs.items():
            values.append("{}='{}'".format(k, v))
        sql = update_sql.format(table, ", ".join(values), condition)
        try:
            self.cursor.execute(sql)
            self.conn.commit()
        except (sqlite3.IntegrityError, sqlite3.OperationalError) as e:
            print(sql)
            print(e)
            return False
        return True

    def commit(self):
        self.conn.commit()

    def destroy(self):
        self.cursor.close()
        self.conn.close()


def trim_comma(field):
    if len(field) == 1:
        attr = str(field).replace(",", "")
    else:
        attr = str(field)
    return attr


def hash_passwd(secret):
    m = md5()
    m.update(secret.encode("utf-8"))
    return m.hexdigest()

