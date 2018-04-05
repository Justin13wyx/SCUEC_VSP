from flask import Flask, request, jsonify, session, redirect, send_file
import db_connector

import os
from urllib.parse import unquote

app = Flask(__name__)
path = os.path
prefix = "/apiv1/{}/{}"

BASEPATH = "."

# ###############
# 为管理员设计的接口
# ###############
#
# 用户信息检索和成绩查看
# 介绍信息更改
# 视频管理(上传和删除)
# 说明文档管理(上传和删除)
# 测评题目上传编辑, 答案修改
# ###############

app.secret_key = 'A0Zr98j/3yX R~XHH!jmN]LWX/,?RT'


@app.route("/")
def index():
    return redirect("http://127.0.0.1:8080/%E5%AE%9E%E9%AA%8C%E5%AE%A4%E9%A1%B9%E7%9B%AE/FE/")


@app.route(prefix.format("user", "doSignin"), methods=["POST"])
def register():
    user_info = request.form.to_dict()
    # 尝试写入数据库
    info_keys = list(user_info.keys())
    info_values = list(user_info.values())
    result = db_connector.set_attr("user_info", tuple(info_keys[:-1]), tuple(info_values[:-1]))  # 设置用户信息
    if result:
        # 用户信息设置成功, 设置密码记录
        result = db_connector.set_attr("secret", ("username", info_keys[-1],), (user_info['username'], db_connector.hash_passwd(info_values[-1]),))
    if result:
        # 初始化用户状态
        result = db_connector.set_attr("user_state", ("username", ), (user_info['username'], ))
    if result:
        # 设置都成功, 注册成功
        return pack_response(0, "ok")
    else:
        # 写入失败, 删除用户信息记录, 注册失败
        db_connector.remove_attr("user_info", "username", user_info['username'])
        db_connector.remove_attr("secret", "username", user_info['username'])
        db_connector.remove_attr("user_state", "username", user_info['username'])
        return pack_response(-1, "database written failed!")


@app.route(prefix.format("user", "doLogin"), methods=["POST"])
def login():
    login_info = request.form.to_dict()
    username = login_info['username']
    # 哈希传过来的密码
    secret = db_connector.hash_passwd(login_info['secret'])
    user_id = db_connector.fetch_data("user_info", "username", username, ("id", "isroot", "isactive",)).fetchone()
    if username in session: # 如果在会话中, 直接确认
        return pack_response(0, "ok", username=username, root=user_id[1])
    # 数据库尝试抓取用户ID
    if not user_id:
        # 抓取失败, 不存在用户记录
        return pack_response(2, "user do not exist")
    if user_id[2] == "0":  # 用户被冻结
        return pack_response(3, "user is deactived")
    # 获取该用户的密码
    true_secret = db_connector.fetch_data("secret", "id", user_id[0], ("secret",)).fetchone()[0]
    if true_secret == secret:  # 密码匹配, 登陆成功
        session['username'] = username
        res = pack_response(0, "ok", username=username, root=user_id[1])
        res.set_cookie("uid", value=username, max_age=10086)
        return res
    else:
        return pack_response(1, "wrong password")


# @app.route(prefix.format("user", "checkLogin"), methods=["GET"])
# def check_login_state():
#     if 'session' not in request.cookies:
#         return pack_response(5, "haven't login")
#     if request.cookies['session'] in session:
#         return pack_response(0, "ok", username=session['username'])
#     else:
#         return pack_response(5, "haven't login")


@app.route(prefix.format("user", "doLogout"), methods=["POST"])
def logout():
    session.pop(request.form['username'], None)
    return pack_response(0, "ok")


@app.route(prefix.format("user", "fetchInfo"), methods=["GET"])
def push_info():
    username = request.values.get("username")
    truename = db_connector.fetch_data("user_info", "username", username, ("truename", )).fetchall()[0][0]
    result_set = db_connector.fetch_data("user_state", "username", username, ("videopass", "instructionpass", "score", "havetest",)).fetchall()
    requirement = db_connector.fetch_data("machine_requirement", "id", 1, ("videorequire", "instructionrequire", "scorerequire")).fetchall()
    return pack_response(0, "ok", truename=truename, userstate=result_set[0], requirement=requirement[0])


@app.route(prefix.format("user", "updateVideoIndex"), methods=["POST"])
def after_watching():
    user = request.form['username']
    passed = int(request.form['video_pass'])
    if db_connector.update_attr("user_state", "username", user, videopass=passed):
        video_require = db_connector.fetch_data("machine_requirement", "id", 1, ("videorequire",)).fetchall()[0]
        return pack_response(0, "ok", finished=passed >= video_require[0])
    return pack_response(-1, "database error")


@app.route(prefix.format("user", "updateInstructionIndex"), methods=["POST"])
def after_opening():
    user = request.form['username']
    passed = int(request.form['instruction_pass'])
    if db_connector.update_attr("user_state", "username", user, instructionpass=passed):
        ins_require = db_connector.fetch_data("machine_requirement", "id", 1, ("instructionrequire",)).fetchall()[0]
        return pack_response(0, "ok", finished=passed >= ins_require[0])
    return pack_response(-1, "database error")


@app.route(prefix.format("video", "getVideoIndex"), methods=["GET"])
def push_video_index():
    videos = os.listdir(path.join(BASEPATH, "video", "0"))
    res = []
    for video in videos:
        res.append([video, path.join("video", "0", video)])
    return pack_response(0, "ok", data=res)


@app.route("/video/<int:machine_id>/<string:video_name>")
def push_video(machine_id, video_name):
    video_path = path.join(BASEPATH, "video", str(machine_id), video_name)
    return send_file(video_path, mimetype="video/mp4")


@app.route(prefix.format("instruction", "getInstructionIndex"), methods=["GET"])
def push_instruction_index():
    pdfs = os.listdir(path.join(BASEPATH, "instructions", "0"))
    res = []
    for pdf in pdfs:
        res.append([pdf, path.join("instructions", "0", pdf)])
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
    pass


@app.route(prefix.format("test", "uploadAnswers"), methods=['POST'])
def check_answers():
    pass


def pack_response(status_code, msg, **kwargs):
    data = {
        "code": status_code,
        "msg": msg
    }
    for k, v in kwargs.items():
        data.update({k: v})
    res = jsonify(data)
    res.headers['Access-Control-Allow-Origin'] = "*"
    return res


if __name__ == "__main__":
    try:
        app.run(debug=True)
    except Exception as e:
        print(e)
