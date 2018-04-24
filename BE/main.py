import os

import db_connector
from flask import Flask, request, jsonify, session, send_file, make_response
from itsdangerous import TimedJSONWebSignatureSerializer, BadSignature, SignatureExpired

app = Flask(__name__)
path = os.path

prefix = "/apiv1/{}/{}"
allowed_extension = [".mp4", ".pdf", ".txt"]

machine_id = 1
BASEPATH = "."

app.secret_key = 'A0Zr98j/3yX R~XHH!jmN]LWX/,?RT'
gen = TimedJSONWebSignatureSerializer(app.secret_key, expires_in=1200)

pass_map = {
    "videos": "videorequire",
    "instructions": "instructionrequire",
    "tests": "scorerequire"
}

main_connector = db_connector.DBConnector("./scuec_vsp")
test_connector = db_connector.DBConnector("./tests/%s/questions" % machine_id)


@app.route(prefix.format("index", "fetchInfo"), methods=['GET'])
def get_reminder():
    text = main_connector.get_attr("reminder", "machineid", machine_id, ("text", )).fetchone()[0]
    if not text:
        return pack_response(4, "error", text="数据获取失败")
    return pack_response(0, "ok", text=text)


@app.route(prefix.format("user", "doSignin"), methods=["POST"])
def register():
    user_info = request.form.to_dict()
    # 尝试写入数据库
    info_keys = list(user_info.keys())
    info_values = list(user_info.values())
    try:
        result = main_connector.set_attr("user_info", tuple(info_keys[:3]), tuple(info_values[:3]))  # 设置用户信息
    except (db_connector.OperationalError, db_connector.IntegrityError) as error:
        if "UNIQUE" in str(error) and "username" in str(error):
            return pack_response(-4, "duplicate username")
        return pack_response(-1, "database written failed!")
    if result:
        # 用户信息设置成功, 设置密码记录
        result = main_connector.set_attr("secret", ("username", info_keys[3],),
                                       (user_info['username'], db_connector.hash_passwd(info_values[3]),))
    if result:
        # 初始化用户状态
        result = main_connector.set_attr("user_state", ("username",), (user_info['username'],))
    if result:
        result = main_connector.set_attr("instruction_record", ("username", "haveread",), (user_info['username'], "",))
    if result:
        # 设置都成功, 注册成功, 如果是从admin页面来的, 就加上一个api的参数
        if request.values.get("token"):
            access = verify_token(request.values.get("token"))
            if access[0] < 0:
                return pack_response(access[0], access[1], access=False)
            return pack_response(0, "ok", api="/admin/%s" % request.values.get("state"), access=True)
        return pack_response(0, "ok")
    else:
        # 写入失败, 删除用户信息记录, 注册失败
        main_connector.remove_attr("user_info", "username", user_info['username'])
        main_connector.remove_attr("secret", "username", user_info['username'])
        main_connector.remove_attr("user_state", "username", user_info['username'])
        main_connector.remove_attr("instruction_record", "username", user_info['username'])
        return pack_response(-1, "database written failed!")


@app.route(prefix.format("user", "doLogin"), methods=["POST"])
def login():
    login_info = request.form.to_dict()
    username = login_info['username']
    # 哈希传过来的密码
    secret = db_connector.hash_passwd(login_info['secret'])
    user_id = main_connector.get_attr("user_info", "username", username, ("id", "isroot", "isactive",)).fetchone()
    if username in session:  # 如果在会话中, 直接确认
        return pack_response(0, "ok", username=username, root=user_id[1])
    # 数据库尝试抓取用户ID
    if not user_id:
        # 抓取失败, 不存在用户记录
        return pack_response(2, "user do not exist")
    if user_id[2] == 0:  # 用户被冻结
        return pack_response(3, "user is deactived")
    # 获取该用户的密码
    true_secret = main_connector.get_attr("secret", "id", user_id[0], ("secret",)).fetchone()[0]
    if true_secret == secret:  # 密码匹配, 登陆成功
        session['username'] = username
        res = pack_response(0, "ok", username=username, root=user_id[1])
        res.set_cookie("uid", value=username, max_age=10086)
        return res
    else:
        return pack_response(1, "wrong password")


@app.route(prefix.format("user", "doLogout"), methods=["POST"])
def logout():
    session.pop(request.form['username'], None)
    return pack_response(0, "ok")


@app.route(prefix.format("user", "delUser"), methods=["POST"])
def rm_user():
    access = verify_token(request.values.get("token"))
    if access[0] < 0:
        return pack_response(access[0], access[1], access=False)
    users2del = request.values.get("targets").split(",")
    for user in users2del:
        try:
            main_connector.remove_attr("user_info", "username", user)  # 删除用户信息
            main_connector.remove_attr("secret", "username", user)  # 删除用户密码
            main_connector.remove_attr("user_state", "username", user)  # 删除用户状态信息
            main_connector.remove_attr("instruction_record", "username", user)  # 删除用户文档阅读信息
        except (db_connector.IntegrityError, db_connector.OperationalError):
            return pack_response(-1, "Error", api="/admin/%s" % request.values.get("state"))
    main_connector.commit()
    return pack_response(0, "ok", api="/admin/%s" % request.values.get("state"), access=True)


@app.route(prefix.format("user", "activeUser"), methods=["POST"])
def active_user():
    access = verify_token(request.values.get("token"))
    if access[0] < 0:
        return pack_response(access[0], access[1], access=False)
    users2active = request.values.get("targets").split(",")
    for user in users2active:
        main_connector.update_attr("user_info", "username", user, {"isactive": 1})
    return pack_response(0, "ok", api="/admin/%s" % request.values.get("state"), access=True)


@app.route(prefix.format("user", "deactiveUser"), methods=["POST"])
def deactive_user():
    access = verify_token(request.values.get("token"))
    if access[0] < 0:
        return pack_response(access[0], access[1], access=False)
    users2deactive = request.values.get("targets").split(",")
    for user in users2deactive:
        try:
            main_connector.update_attr("user_info", "username", user, {"isactive": 0})
            main_connector.update_attr("user_info", "username", user, {"isroot": 0})
        except (db_connector.OperationalError, db_connector.IntegrityError):
            return pack_response(-1, "error", api="/admin/%s" % request.values.get("state"))
    return pack_response(0, "ok", api="/admin/%s" % request.values.get("state"), access=True)


@app.route(prefix.format("user", "grantUser"), methods=["POST"])
def grant_user():
    access = verify_token(request.values.get("token"))
    if access[0] < 0:
        return pack_response(access[0], access[1], access=False)
    users2grant = request.values.get("targets").split(",")
    for user in users2grant:
        try:
            main_connector.update_attr("user_info", "username", user, {"isroot": 1})
        except (db_connector.OperationalError, db_connector.IntegrityError):
            return pack_response(-1, "error", api="/admin/%s" % request.values.get("state"))
    return pack_response(0, "ok", api="/admin/%s" % request.values.get("state"), access=True)


@app.route(prefix.format("user", "ungrantUser"), methods=["POST"])
def ungrant_user():
    access = verify_token(request.values.get("token"))
    if access[0] < 0:
        return pack_response(access[0], access[1], access=False)
    users2ungrant = request.values.get("targets").split(",")
    for user in users2ungrant:
        try:
            main_connector.update_attr("user_info", "username", user, {"isroot": 0})
        except (db_connector.OperationalError, db_connector.IntegrityError):
            return pack_response(-1, "error", api="/admin/%s" % request.values.get("state"))
    return pack_response(0, "ok", api="/admin/%s" % request.values.get("state"), access=True)


@app.route(prefix.format("user", "canTest"), methods=['GET'])
def check_access2test():
    username = request.args.get("user")
    info = main_connector.get_attr("user_state", "username", username, ("videopass", "instructionpass", )).fetchall()[0]
    require = main_connector.get_attr("machine_requirement", "id", machine_id, ("videorequire", "instructionrequire")).fetchall()[0]
    if info[0] >= require[0] and info[1] >= require[1]:
        return pack_response(0, "ok", access=True)
    return pack_response(0, "ok", access=False)


@app.route(prefix.format("user", "fetchInfo"), methods=["GET"])
def push_info():
    username = unquote(request.values.get("username"))
    truename = main_connector.get_attr("user_info", "username", username, ("truename",)).fetchone()
    result_set = main_connector.get_attr("user_state", "username", username,
                                       ("videopass", "instructionpass", "score", "havetest",)).fetchall()
    requirement = main_connector.get_attr("machine_requirement", "id", machine_id,
                                        ("videorequire", "instructionrequire", "scorerequire")).fetchall()
    return pack_response(0, "ok", truename=truename[0], userstate=result_set[0], requirement=requirement[0])


@app.route(prefix.format("user", "updateVideoIndex"), methods=["POST"])
def after_watching():
    user = request.values.get('username')
    passed = int(request.form['video_pass'])
    if main_connector.update_attr("user_state", "username", user, {"videopass": passed}):
        video_require = main_connector.get_attr("machine_requirement", "id", machine_id, ("videorequire",)).fetchall()[0]
        return pack_response(0, "ok", finished=passed >= video_require[0])
    return pack_response(-1, "database error")


@app.route(prefix.format("user", "updateInstructionIndex"), methods=["POST"])
def after_opening():
    user = request.values.get("username")
    read_item = request.form['ins']
    haveread = main_connector.get_attr("instruction_record", "username", user, ("haveread",)).fetchall()
    if haveread:
        haveread = haveread[0][0]
    else:
        haveread = ""
    if read_item in haveread.split(","):
        return pack_response(0, "ok")
    else:
        if haveread == "":
            haveread = read_item
        else:
            haveread += ",%s" % read_item
        if main_connector.update_attr("instruction_record", "username", user, {"haveread": haveread}):
            require = \
                main_connector.get_attr("machine_requirement", "id", machine_id, ("instructionrequire",)).fetchall()[0]
            main_connector.update_attr("user_state", "username", user, {"instructionpass": len(haveread.split(","))})
            return pack_response(0, "ok", finished=len(haveread.split(",")) >= int(require[0]))
        return pack_response(-1, "database error")


@app.route(prefix.format("video", "getVideoIndex"), methods=["GET"])
def push_video_index():
    videos = os.listdir(path.join(BASEPATH, "videos", str(machine_id)))
    videos.sort()
    res = []
    for video in videos:
        res.append([video, path.join("videos", str(machine_id), video)])
    return pack_response(0, "ok", data=res)


@app.route("/videos/<int:machine_id>/<string:video_name>")
def push_video(machine_id, video_name):
    video_path = path.join(BASEPATH, "videos", str(machine_id), video_name)
    return send_file(video_path, mimetype="video/mp4")


@app.route(prefix.format("instruction", "getInstructionIndex"), methods=["GET"])
def push_instruction_index():
    pdfs = os.listdir(path.join(BASEPATH, "instructions", str(machine_id)))
    res = []
    for pdf in pdfs:
        res.append([pdf, path.join("instructions", str(machine_id), pdf)])
    return pack_response(0, "ok", data=res)


@app.route("/instructions/<int:machine_id>/<string:instruction>")
def push_instruction(machine_id, instruction):
    instruction_path = path.join(BASEPATH, "instructions", str(machine_id), instruction)
    res = send_file(instruction_path, as_attachment=False, mimetype="application/pdf")
    res.headers["Content-Disposition"] = "inline"
    res.headers['Access-Control-Allow-Origin'] = "*"
    return res


@app.route(prefix.format("test", "getQuestions"), methods=['GET'])
def push_questions():
    mac_id = request.args.get("mac_id")
    data = []
    questions = test_connector.get_all("questions").fetchall()
    for question in questions:
        tmp = []
        question_item = {"question": question[1], "score": question[4], "qid": question[0]}
        selections = question[2].split(",")
        for selection_id in selections:
            tmp.append(test_connector.get_attr("selections", "id", selection_id, ("content",)).fetchall()[0][0])
        question_item.update(selections=tmp)
        data.append(question_item)
    return pack_response(0, "ok", data=data)


@app.route(prefix.format("test", "uploadAnswers"), methods=['POST'])
def check_answers():
    user_answer = request.values.get("answers").split(",")
    username = request.args.get("user")
    answer = user_answer[1::2]
    questions = user_answer[::2]
    score = 0
    for index in range(len(questions)):
        ques_info = test_connector.get_attr("questions", "id", questions[index], ("answer", "score", )).fetchall()[0]
        print(answer[index])
        print(ques_info[0])
        if int(answer[index]) == int(ques_info[0]):
            score += ques_info[1]
    # 同时更新用户状态表
    max_score = main_connector.get_attr("user_state", "username", username, ("score", )).fetchone()[0]
    if score > max_score:
        main_connector.update_attr("user_state", "username", username, {"score": score, "havetest": 1})
    else:
        main_connector.update_attr("user_state", "username", username, {"havetest": 1})
    return pack_response(0, "ok", score=score)


@app.route(prefix.format("admin", "getToken"), methods=['POST'])
def validate_user():
    user = request.values.get("username")
    access = main_connector.get_attr("user_info", "username", user, ("isroot", "isactive",)).fetchall()[0]
    if access[0] == 0:
        return pack_response(233, "No access", access=False)
    if access[1] == 0:
        return pack_response(23, "Not active", access=False)
    token = get_token({"username": user})
    return pack_response(0, "ok", access=True, token=token.decode())


@app.route(prefix.format("admin", "users"), methods=['POST'])
def admin_users():
    access = verify_token(request.values.get("token"))
    if access[0] < 0:
        return pack_response(access[0], access[1], access=False)
    title = ["ID", "用户名", "真实姓名", "邮箱", "是管理员", "是否激活", "用户状态"]
    data = []
    info = main_connector.get_all("user_info").fetchall()
    state = main_connector.get_all("user_state").fetchall()
    require = main_connector.get_all("machine_requirement").fetchall()[0][1:]
    for k, v in zip(info, state):
        tmp = {"info": k, "state": v[2:]}
        data.append(tmp)
    return pack_response(0, "ok", title=title, require=require, data=data, attr="users", access=True)


@app.route(prefix.format("admin", "videos"), methods=['POST'])
def admin_videos():
    access = verify_token(request.values.get("token"))
    if access[0] < 0:
        return pack_response(access[0], access[1], access=False)
    title = ["ID", "视频名", "大小", "类型"]
    data = []
    videos = os.listdir(path.join(BASEPATH, "videos", str(machine_id)))
    videos.sort()
    for video in videos:
        data.append([video, get_size(path.join(BASEPATH, "videos", str(machine_id), video)), path.splitext(video)[-1]])
    return pack_response(0, "ok", title=title, data=data, attr="videos", access=True)


@app.route(prefix.format("admin", "instructions"), methods=['POST'])
def admin_ins():
    access = verify_token(request.values.get("token"))
    if access[0] < 0:
        return pack_response(access[0], access[1], access=False)
    title = ["ID", "文档名", "大小", "类型"]
    data = []
    ins = os.listdir(path.join(BASEPATH, "instructions", str(machine_id)))
    for instruction in ins:
        data.append(
            [instruction, get_size(path.join(BASEPATH, "instructions", str(machine_id), instruction)),
             path.splitext(instruction)[-1]]
        )
    return pack_response(0, "ok", title=title, data=data, attr="instructions", access=True)


@app.route(prefix.format("admin", "tests"), methods=['POST'])
def admin_tests():
    access = verify_token(request.values.get("token"))
    if access[0] < 0:
        return pack_response(access[0], access[1], access=False)
    title = ["ID", "题目", "选项", "答案"]
    raw_data = test_connector.get_all("questions").fetchall()
    data = []
    for question in raw_data:
        selections = []
        tmp = [question[1]]
        for selection_id in question[2].split(","):
            selections.append(test_connector.get_attr("selections", "id", int(selection_id), ("content", )).fetchone()[0])
        tmp.append(selections)
        tmp.append(question[3])
        data.append(tmp)
    return pack_response(0, "ok", title=title, data=data, attr="tests", access=True)


@app.route(prefix.format("admin", "setpass"), methods=['POST'])
def set_pass():
    access = verify_token(request.values.get("token"))
    if access[0] < 0:
        return pack_response(access[0], access[1], access=False)
    passline = request.values.get("passline")
    state = pass_map[request.values.get("state")]
    if main_connector.update_attr("machine_requirement", "id", machine_id, {state: passline}):
        return pack_response(0, "ok")
    return pack_response(-1, "wrong")


@app.route(prefix.format("admin", "del"), methods=['POST'])
def delete_item():
    access = verify_token(request.values.get("token"))
    if access[0] < 0:
        return pack_response(access[0], access[1], access=False)
    if request.values.get("state") == "tests":
        test_connector.remove_attr("questions", "title", request.values.get("target"), commit=True)
        return pack_response(0, "ok", api="/admin/%s" % request.values.get("state"), access=True)
    base_path = path.join(BASEPATH, request.values.get("state"), str(machine_id))
    items = request.values.get("target").split(",")
    for item in items:
        des = path.join(base_path, item)
        try:
            os.remove(des)
        except OSError:
            return pack_response(-1, "Error", api="/admin/%s" % request.values.get("state"))
    return pack_response(0, "ok", api="/admin/%s" % request.values.get("state"), access=True)


@app.route(prefix.format("admin", "newQuestions"), methods=['POST'])
def write_new_questions():
    return write2db(request.values.get("data").encode("utf-8"))


@app.route(prefix.format("admin", "upload"), methods=['OPTIONS', 'POST'])
def receive_files():
    access = verify_token(request.values.get("token"))
    if access[0] < 0:
        return pack_response(access[0], access[1], access=False)
    if request.method == "OPTIONS":
        res = make_response()
        res.headers['Access-Control-Allow-Origin'] = "*"
        return res
    if request.values.get("state") == "tests":
        return write2db(request.get_data())
    dest = path.join(BASEPATH, request.values.get("state"), str(machine_id))
    raw_data = request.get_data()
    filename = request.values.get("filename")
    with open(path.join(dest, filename), mode="wb") as f:
        f.write(raw_data)
    return pack_response(0, "ok", api="/admin/%s" % request.values.get("state"), access=True)


def write2db(data):
    # 这个地方注意windows的问题, 有可能用户上传的是gbk编码的, 也可能是utf-8编码的
    try:
        text_data = data.decode("utf-8")
    except UnicodeDecodeError:
        # 那么就猜测是gbk, 当然这里应该更加准确的判断
        text_data = data.decode("gbk")
    # 过滤一下windows的BOM和\r
    text_data = text_data.replace("\r", "").replace("\ufeff", "")
    questions = text_data.split("\n\n")
    selection_id = test_connector.get_attr("sqlite_sequence", "name", "selections", ("seq", )).fetchone()
    if not selection_id:
        selection_id = 1
    else:
        selection_id = selection_id[0] + 1
    for question in questions:
        items = question.split("\n")
        title = items[0]
        start_id = selection_id
        tmp = 0
        for selection in items[1:]:
            if selection == '':
                continue
            tmp += 1
            try:
                if selection.startswith("*"):
                    print(tmp)
                    selection = selection.split(" ", maxsplit=1)[-1]
                    right_id = tmp
                test_connector.set_attr("selections", ("id", "content",), (selection_id, selection, ))
                selection_id += 1
            except (db_connector.OperationalError, db_connector.IntegrityError) as error:
                print(error)
                return pack_response(1, "error")
        # 选项全部写入数据库之后
        try:
            test_connector.set_attr("questions", ("title", "selections", "answer", ), (title, ",".join([str(x) for x in range(start_id, selection_id)]), str(right_id)))
        except (db_connector.OperationalError, db_connector.IntegrityError) as error:
            print(error)
            return pack_response(1, "error")
    return pack_response(0, "ok", api="/admin/%s" % request.values.get("state"), access=True)


def get_token(obj):
    return gen.dumps(obj)


def get_size(path):
    flag = ["Gb", "Mb", "Kb", "B"]
    size = raw_size = os.path.getsize(path)
    while size > 1024:
        size = size >> 10
        flag.pop()
    return str(size) + flag[-1]


def verify_token(token):
    try:
        data = gen.loads(token)
    except BadSignature as error:
        return -1, error.message
    except SignatureExpired as exp:
        return -2, exp.message
    return 0, data


def unquote(string):
    return string.replace("%", "\\").encode("utf-8").decode("unicode-escape")


def pack_response(status_code, msg, **kwargs):
    data = {
        "code": status_code,
        "msg": msg
    }
    for k, v in kwargs.items():
        data.update({k: v})
    res = jsonify(data)
    res.headers['Access-Control-Allow-Origin'] = "*"
    res.headers['X-Frame-Options'] = "DENY"
    res.headers['X-XSS-Protection'] = "1"
    return res


if __name__ == "__main__":
    try:
        app.run(debug=True, threaded=True)
    except Exception as e:
        print(e)
