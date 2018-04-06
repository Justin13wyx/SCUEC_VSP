import sqlite3
from hashlib import md5

CORRECT = 0
INCORRECT = 1
NONEXIST = 2
DEACTIVED = 3


conn = sqlite3.connect("./scuec_vsp", check_same_thread=False)
cursor = conn.cursor()

IntegerityError = sqlite3.IntegrityError
OperationalError = sqlite3.OperationalError

fetch_sql = "SELECT {} FROM {} WHERE {}"
set_sql = "INSERT INTO {} {} VALUES {}"
del_sql = "DELETE FROM {} WHERE {}"
update_sql = "UPDATE {} SET {} WHERE {}"


def get_attr(table, keyword, value, fields):
    condition = "{}='{}'".format(str(keyword), str(value))
    sql = fetch_sql.format(trim_comma(fields).replace("\'", "")[1:-1], str(table), condition)
    try:
        result_cursor = cursor.execute(sql)
    except (sqlite3.IntegrityError, sqlite3.OperationalError) as e:
        print(sql)
        print(e)
        return False
    return result_cursor


def set_attr(table, keywords, attributes):
    sql = set_sql.format(str(table), trim_comma(keywords).replace("\'", ""), trim_comma(attributes))
    try:
        cursor.execute(sql)
        conn.commit()
    except (sqlite3.IntegrityError, sqlite3.OperationalError) as e:
        print(sql)
        print(e)
        return False
    return True


def remove_attr(table, keyword, value):
    condition = "{}='{}'".format(keyword, value)
    sql = del_sql.format(table, condition)
    cursor.execute(sql)
    conn.commit()


def update_attr(table, keyword, value, **kwargs):
    condition = "{}='{}'".format(keyword, value)
    values = []
    for k, v in kwargs.items():
        values.append("{}='{}'".format(k, v))
    sql = update_sql.format(table, ", ".join(values), condition)
    try:
        cursor.execute(sql)
        conn.commit()
    except (sqlite3.IntegrityError, sqlite3.OperationalError) as e:
        print(sql)
        print(e)
        return False
    return True


def trim_comma(field):
    if len(field) == 1:
        attr = str(field).replace(",", "")
    else:
        attr = str(field)
    return attr


def check_passwd(user, password):
    id_cursor = get_attr("user_info", "username", user, ("id", "isactived"))
    if not id_cursor:
        return NONEXIST
    row = id_cursor.fetchall()
    if row[1] == "0":
        return DEACTIVED
    hash_passwd = get_attr("user_info", "id", row[0], "secret")
    md5.update(password.encode())
    if hash_passwd == md5.hexdigest():
        return CORRECT
    else:
        return INCORRECT


def hash_passwd(secret):
    m = md5()
    m.update(secret.encode("utf-8"))
    return m.hexdigest()

