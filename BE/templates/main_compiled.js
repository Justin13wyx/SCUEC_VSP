"use strict";

(function () {
	var nav_btns = document.getElementsByClassName("nav_btn");
	var main_area = document.getElementById("main");
	var video_area = document.getElementById("video_area");
	var instruction_area = document.getElementById("instruction_area");
	var test_area = document.getElementById("test_area");
	var op_btns = document.getElementById('control_center').children;
	var curView = document.getElementsByClassName("current")[0];
	var reminder = document.getElementById("reminder");

	var btn2view = new Map();
	btn2view.set("index", main_area);
	btn2view.set("video", video_area);
	btn2view.set("instruction", instruction_area);
	btn2view.set("test", test_area); // data-role和目标视图的关联映射
	var btn2func = new Map();
	btn2func.set("fetch_info", fetch_info);
	btn2func.set("fetch_video", fetch_video);
	btn2func.set("fetch_instruction", fetch_instruction);
	btn2func.set("fetch_questions", check_haveaccess2test); // data-func和目标回调函数引用的关联映射

	var admin_entry = document.getElementById('admin_entry');
	var admin_area = document.getElementById("admin_area");
	var close_btn = document.getElementById("icon-close");
	var aside_nav = document.getElementsByClassName("aside_select");
	var aside_list = document.getElementsByClassName("aside_list");
	var search_bar = document.getElementsByClassName("action_bar")[0];
	var action_btns = document.getElementsByClassName("action_btn");
	var control_btns = document.getElementById("admin_control").children;
	var admin_inputbox = document.getElementById("admin_inputbox");
	var admin_input = document.getElementById("input_area");
	var admin_uploadbox = document.getElementById("admin_uploadbox");
	var admin_upload_btns = document.getElementsByClassName("upload_control_btn");
	var real_upload = document.getElementById("real_upload");
	var preview_area = document.getElementById("preview_area");
	var question_box = document.getElementById("admin_questionbox");
	var question_btns = document.getElementsByClassName("control_btn");
	var question_input = document.getElementById("manual_question");
	var question_section = document.getElementById("question_section");
	var test_control_area = document.getElementsByClassName("test_control_area")[0];
	var test_control = test_control_area.children;

	var video = document.getElementById("video_play");
	var video_list = document.getElementById("video_list");
	var video_control = document.getElementById("video_control");
	var play_btn = document.getElementById("play_btn");
	var tokens = null;
	var max_view = 0;
	var max_viewtime = 0;

	var read_trigger = document.getElementById('readpdf_btn');
	var pdfs = document.getElementById("pdf_preview");
	var selected_pdf = null;

	var user_mask = document.getElementById("user_mask");
	var login_panel = document.getElementById("login_panel");
	var action_switch = document.getElementById("action_switch");
	var login_part = document.getElementsByClassName("login_part");
	var login = document.getElementsByClassName("login");
	var greeting = document.getElementById("greeting");
	var submit_login = document.getElementById("submit_login");
	var mask = document.getElementById("mask");
	var maskmask = document.getElementById("mask_for_mask");
	var logout_btn = document.getElementById("logout_btn");
	var tooltip = document.getElementById("user_tooltip");

	var display_result = document.getElementById("display_result");

	var canvas = document.getElementById("loading_token");
	var context = canvas.getContext('2d');
	var result = document.getElementById("result_div");
	var result_canvas = document.getElementById("result");
	var result_context = result_canvas.getContext("2d");
	var loading_timer = 0;
	var start_angle = 0;

	var access = 0;
	var username = "";
	var intest = 0;
	var time_record = 0;

	var admin_state = "";
	var files = [];
	var send_queue = [];

	window.onload = fetch_info;

	// 具体的管理功能事件绑定
	for (var i = 0; i < action_btns.length; i++) {
		action_btns[i].addEventListener("click", function (e) {
			e.preventDefault();
			var t = e.target || e.srcElement;
			if (t.getAttribute("class").match("action_disable")) {
				alert("功能不可用!");
				return;
			}
			var action = t.dataset['action'];
			if (action == "setpass") {
				toggle_admin_inputbox(true);
				return;
			}
			do_action(action);
		});
	}

	// 对设置及格线的那个窗口按钮的事件绑定
	for (var _i = 0; _i < control_btns.length; _i++) {
		control_btns[_i].addEventListener("click", function (e) {
			e.preventDefault();
			var t = e.target || e.srcElement;
			var action = t.dataset['action'];
			if (action == "cancel") toggle_admin_inputbox(false);else {
				// 执行操作
				var _data = new Map();
				_data.set("token", localStorage.getItem("token"));
				_data.set("username", username);
				_data.set("state", admin_state);
				_data.set("passline", admin_input.children.pass.value);
				_data = make_data(_data);
				if (confirm("确定设置成" + admin_input.children.pass.value + "?")) fetch_data(true, "POST", "http://127.0.0.1:5000/apiv1/admin/setpass", check_setpass_state, _data);
			}
		});
	}

	// footer的管理入口
	admin_entry.addEventListener("click", function (e) {
		e.preventDefault();
		active_admin();
	});

	// 对测评界面的按钮绑定
	for (var _i2 = 0; _i2 < test_control.length; _i2++) {
		test_control[_i2].addEventListener("click", function (e) {
			e.preventDefault();
			var t = e.target || e.srcElement;
			var action = t.dataset['action'];
			if (action == "erase") {
				clear_all();
			} else if (action == "submit") {
				submit_answer();
			}
		});
	}

	// 手动录入题目的窗口取消和确定按钮事件绑定
	for (var _i3 = 0; _i3 < question_btns.length; _i3++) {
		var btn = question_btns[_i3];
		btn.addEventListener("click", function (e) {
			e.preventDefault();
			var t = e.target || e.srcElement;
			var action = t.dataset['action'];
			if (action == "cancel") toggle_new_question(false);else if (action == "confirm") confirm_new_question();else if (action == "switch") switch_questionbox();
		});
	}

	// 上传界面的按钮事件绑定
	for (var _i4 = 0; _i4 < admin_upload_btns.length; _i4++) {
		var _btn = admin_upload_btns[_i4];
		_btn.addEventListener("click", function (e) {
			e.preventDefault();
			var t = e.target || e.srcElement;
			var action = t.dataset['action'];
			if (action == "choose") real_upload.click();else if (action == "cancel") toggle_upload(false);else if (action == "upload") do_upload(e.target);
		});
	}

	// 打印按钮的事件绑定
	result_div.children[1].addEventListener("click", function (e) {
		e.preventDefault();
		var dataURL = result_canvas.toDataURL("image/png");
		var newW = window.open();
		newW.document.write("<img src=\"" + dataURL + "\"/>");
		newW.setTimeout(newW.print, 200);
	});

	// 报告中 取消按钮的事件绑定
	result_div.children[2].addEventListener("click", function (e) {
		e.preventDefault();
		toggle_result(false);
	});

	// 关闭管理面板的事件绑定
	close_btn.addEventListener("click", function (e) {
		e.preventDefault();
		e.cancelBubble = true;
		deactive_admin();
	});

	// 管理功能切换事件绑定
	for (var _i5 = 0; _i5 < aside_nav.length; _i5++) {
		var nav_btn = aside_nav[_i5];
		nav_btn.addEventListener("click", function (e) {
			e.preventDefault();
			var target = e.srcElement || e.target;
			if (target.tagName == "SPAN") {
				target = target.parentElement;
			}
			for (var j = 0; j < aside_list.length; j++) {
				var ele = aside_list[j];
				ele.setAttribute("class", "aside_list");
				if (ele == target.parentElement) ele.setAttribute("class", "aside_list aside_selected");
			}
			var api_path = target.getAttribute("href");
			admin_state = api_path.split("/")[2];
			render_admin(api_path);
		});
	}

	// 导航栏的按钮切换view的事件绑定

	var _loop = function _loop(_i6) {
		var btn = nav_btns[_i6];
		btn.addEventListener("click", function (e) {
			e.preventDefault();
			if (intest == 1) {
				if (confirm("当前正在测试中!\n是否退出测试?")) {
					intest = 0;
				} else return;
			}
			menu_switch(e, btn, btn2view.get(btn.getAttribute("data-role")), btn2func.get(btn.getAttribute("data-callback")));
		});
	};

	for (var _i6 = 0; _i6 < nav_btns.length; _i6++) {
		_loop(_i6);
	}

	// 和上面导航栏切换一样的绑定, 只不过是建立了点击映射

	var _loop2 = function _loop2(_i7) {
		var btn = op_btns[_i7];
		// 这里直接将操作区的按钮和上面的导航按钮建立联系
		var index = btn.getAttribute("data-map");
		if (index !== "0") {
			btn.addEventListener("click", function (e) {
				e.preventDefault();
				nav_btns[index].click();
			});
		} else {
			btn.addEventListener("click", function (e) {
				e.preventDefault();
				e.cancelBubble = true;
				if (access) toggle_result(true);else alert("你还没有登录!");
			});
		}
	};

	for (var _i7 = 0; _i7 < op_btns.length; _i7++) {
		_loop2(_i7);
	}

	// 登录和注册的面板切换的事件绑定

	var _loop3 = function _loop3(_i8) {
		var btn = action_switch.children[_i8];
		var role = btn.getAttribute("data-role");
		btn.addEventListener("click", function (e) {
			e.preventDefault();
			panel_switch(role);
			for (var j = 0; j < action_switch.children.length; j++) {
				action_switch.children[j].removeAttribute("class");
			}
			btn.setAttribute("class", "current_action");
		});
	};

	for (var _i8 = 0; _i8 < action_switch.children.length; _i8++) {
		_loop3(_i8);
	}

	// 用户头像点击的事件绑定, 根据是否授权分成呼出登录面板和个人信息两种
	user_mask.addEventListener("click", function (e) {
		e.cancelBubble = true;
		e.preventDefault();
		if (!access) toggle_login(1);else toggle_tooltip(1); // 登录之后改为呼出用户信息
	});

	// 登录和注册的提交事件绑定
	submit_login.addEventListener("click", function (e) {
		// 做提交操作
		do_login_or_register();
	});

	// 注册登出按钮的点击事件
	logout_btn.addEventListener("click", function (e) {
		logout();
	});

	display_result.addEventListener("click", function (e) {
		toggle_result(true);toggle_tooltip(false);
	});

	// 防止过度后移, 记录当前观看的最大位置
	video.ontimeupdate = function () {
		if (max_viewtime < video.currentTime) {
			max_viewtime = video.currentTime;
		} else return;
	};

	// 视频列表的点击事件绑定
	video_list.addEventListener("click", function (e) {
		target = e.target || e.srcElement;
		if (target.hasAttribute("link")) {
			// 检查是否跳跃观看了
			if (checkplaying(e.target)) {
				max_viewtime = 0;
				if (video.children[0].getAttribute("src") == e.target.getAttribute("link")) {
					return; // 如果点的就是当前正在播放的, 直接返回
				}
				video.children[0].setAttribute("src", e.target.getAttribute("link"));
				video.load();
				for (var _i9 = 0; _i9 < video_list.children[0].children.length; _i9++) {
					var node = video_list.children[0].children[_i9];
					node.removeAttribute("class");
				}
				target.setAttribute("class", "playing");
			} else alert("请按照顺序观看");
		}
	});

	// 播放完成之后的回调
	video.onended = function () {
		max_viewtime = 0;
		if (document.getElementsByClassName("playing")[0].children[0].innerHTML == "○") max_view += 1;
		// 告诉服务端, 用户看完了
		fetch_data(false, "POST", "http://127.0.0.1:5000/apiv1/user/updateVideoIndex", checkfinished, "username=" + username + "&video_pass=" + max_view);
		// 自动获取下一个的视频
		if (max_view >= video_list.children[0].children.length - 1) {
			video.pause();
			return;
		}
		video_list.children[0].children[max_view - 1].children[0].innerHTML = "√";
		video_list.children[0].children[max_view].click();
		video.play();
		video_control.children[1].innerHTML = "暂停";
	};

	// 前进, 暂停播放, 后移的事件绑定
	video_control.addEventListener('click', function (e) {
		e.preventDefault();
		var target = e.target || e.srcElement;
		if (target.dataset['role'] == "-10") {
			video.currentTime -= 10;
		} else if (target.dataset['role'] == "+10") {
			if (video.currentTime + 1 < max_viewtime) {
				video.currentTime += 10;
			} else video.currentTime = max_viewtime;
		} else if (target.dataset['role'] == "play") {
			toggle_play();
		}
	});

	// pdf点击事件绑定
	pdfs.addEventListener("click", function (e) {
		e.preventDefault();
		pdf = e.target || e.srcElement;
		for (var _i10 = 0; _i10 < pdfs.children.length; _i10++) {
			pdfs.children[_i10].setAttribute("class", "pdf");
		}
		if (pdf.getAttribute("class") == "pdf") {
			pdf.setAttribute("class", "pdf selected_pdf");
			selected_pdf = pdf.getAttribute("link");
		} else {
			selected_pdf = null;
		}
	});

	// 开始阅读的事件绑定
	read_trigger.addEventListener("click", function (e) {
		if (selected_pdf) {
			var pdf_win = window.open("http://127.0.0.1:5000/" + selected_pdf);
			Object.defineProperty(pdf_win, "timer", {
				value: time_record, // 这个值需要从后台拉取
				writable: true
			});
			Object.defineProperty(pdf_win, "time_handler", {
				value: 0,
				writable: true
			});
			Object.defineProperty(pdf_win, "starttimer", {
				value: function value() {
					pdf_win.time_handler = pdf_win.setInterval(function () {
						if (pdf_win.timer <= 3600) {
							pdf_win.timer += 1;
							// 需要post用户观看时间
							if (pdf_win.timer % 2 == 0) {
								fetch_data(false, "POST", "http://127.0.0.1:5000/apiv1/user/updateInstructionTime", check_ins_update, "username=" + username + "&time=" + pdf_win.timer);
							}
						} else {
							pdf_win.alert("你已经阅读达到2小时, 现在可以进行测试了.");
						}
					}, 1000);
				}
			});
			setTimeout(pdf_win.starttimer, 1000);
			// data = `username=${username}&ins=${selected_pdf}`;
			// fetch_data(false, "POST", "http://127.0.0.1:5000/apiv1/user/updateInstructionIndex", check_ins_update, data)
		} else {
			alert("你还没有选择阅读材料.");
		}
	});

	// 选择文件之后的事件绑定
	real_upload.onchange = function () {
		illegal_file = check_files(this.files, admin_state);
		// 存在不合法的文件
		if (illegal_file) {
			alert(illegal_file + "类型不合法或者大于200MB, 请重新选择");
			files = null;
			return;
		} else {
			// 文件类型检查通过
			render_previewlist(this.files);
			files = this.files;
		}
	};

	/**
  * 检查阅读材料的阅读回调
  * @param  {[type]} res [description]
  * @return {[type]}     [description]
  */
	// function check_ins_update(res) {
	// 	if (res['finished']) {
	// 		alert("你已经完成说明阅读要求")
	// 	}
	// }
	function check_ins_update(res) {
		if (res['code'] !== 0) {
			pdf_win.alert("当前无法连接到服务器, 阅读时间将不会上传!\n请联系技术支持或者网站管理员.");
		}
	}

	/**
  * 1. 向远端验证用户身份, 并且获取一个token用来在以后的API调用时进行AUTH
  * 2. 激活管理页面
  * @return {[type]} [description]
  */
	function active_admin() {
		if (access) {
			fetch_data(true, "POST", "http://127.0.0.1:5000/apiv1/admin/getToken", _active_admin, "username=" + username);
			admin_area.style['transform'] = "scale3d(1, 1, 1)";
		} else alert("你还没有登录!");
	}

	/**
  * 召唤出管理页面, 默认用用户管理做首页
  * @param  {[type]} res [description]
  * @return {[type]}     [description]
  */
	function _active_admin(res) {
		if (!res['access']) {
			alert("你没有权限访问.");
			deactive_admin();
		} else {
			token = res['token'];
			localStorage.setItem("token", token);
			// 模拟点击用户管理
			aside_nav[0].click();
		}
	}

	/**
  * 删除token并且把admin页面隐藏
  * @return {[type]} [description]
  */
	function deactive_admin() {
		localStorage.removeItem("token");
		admin_state = "";
		admin_area.style['transform'] = "scale3d(1, 0, 1)";
		nav_btns[0].click();
	}

	/**
  * 主页的机器信息和介绍抓取
  * @return {[type]} [description]
  */
	function fetch_info() {
		fetch_data(false, "GET", "http://127.0.0.1:5000/apiv1/index/fetchInfo", fill_reminder);
	}

	function fill_reminder(res) {
		reminder.innerHTML = res['text'];
	}

	/**
  * 视频列表抓取和对应的地址
  * @return {[type]} [description]
  */
	function fetch_video() {
		fetch_data(true, "GET", "http://127.0.0.1:5000/apiv1/video/getVideoIndex", _fetch_video);
	}

	/**
  * 渲染视频列表, 并进一步的抓取用户当前已经看到的, 并修改列表
  * @param  {[type]} res [description]
  * @return {[type]}     [description]
  */
	function _fetch_video(res) {
		videos = res['data'];
		html = "<ul>";
		for (var _i11 = 0; _i11 < videos.length; _i11++) {
			var _video = videos[_i11];
			html += "<li class=\"\" link=http://127.0.0.1:5000/" + _video[1] + "><span class=\"seen_token\">\u25CB</span>" + _video[0] + "</li>";
		}
		html += "</ul>";
		video_list.innerHTML = html;
		fetch_data(true, "GET", "http://127.0.0.1:5000/apiv1/user/fetchInfo?username=" + escape(username), highlight_videolist);
	}

	/**
  * _fetch_video中的回调函数, 修改列表完成情况并且自动将当前该观看的视频模拟点击
  * @param  {[type]} res [description]
  * @return {[type]}     [description]
  */
	function highlight_videolist(res) {
		haveseen = res.userstate[0];
		max_view = haveseen;
		tokens = document.getElementsByClassName("seen_token");
		if (tokens.length == 0) return;
		for (var _i12 = 0; _i12 < haveseen; _i12++) {
			tokens[_i12].innerHTML = "√";
		}
		tokens[haveseen].parentElement.setAttribute("class", "playing");
		tokens[haveseen].parentElement.click();
	}

	/**
  * 观看完成视频的回调, 检测用户是否已经完成观看任务
  * @param  {[type]} res [description]
  * @return {[type]}     [description]
  */
	function checkfinished(res) {
		if (res['code'] == '0') {
			for (var _i13 = 0; _i13 < max_view; _i13++) {
				tokens[_i13].innerHTML = "√";
			}
			if (res['finished']) alert("你已经完成视频观看要求!");
		} else {
			max_view--;
			alert("远端数据库更新失败!");
		}
	}

	/**
  * 确保用户只可以按照顺序进行观看, 这个处理逻辑是和统计功能挂钩的
  * @param  {[type]} target [description]
  * @return {[type]}        [description]
  */
	function checkplaying(target) {
		iter_nodes = video_list.children[0].children;
		for (var _i14 = 0; _i14 < iter_nodes.length; _i14++) {
			if (target == iter_nodes[_i14]) {
				if (_i14 == 0) return true;
				if (iter_nodes[_i14 - 1].children[0].innerHTML == "√") {
					return true;
				} else return false;
			}
		}
	}

	/**
  * 文档列表抓取和对应的地址
  * @return {[type]} [description]
  */
	function fetch_instruction() {
		fetch_data(true, "GET", "http://127.0.0.1:5000/apiv1/instruction/getInstructionIndex", _fetch_instruction);
	}

	/**
  * 渲染PDF
  * @param  {[type]} res [description]
  * @return {[type]}     [description]
  */
	function _fetch_instruction(res) {
		html = "";
		for (var _i15 = 0; _i15 < res['data'].length; _i15++) {
			html += "<div class=\"pdf\" link=\"" + res['data'][_i15][1] + "\">\n\t\t\t\t\t\t<p>" + res['data'][_i15][0].split(".")[0] + "</p>\n\t\t\t\t\t</div>";
		}
		pdfs.innerHTML = html;
	}

	/**
  * 测评题目获取
  * @return {[type]} [description]
  */
	function fetch_questions(res) {
		if (res['access'] == true) {
			fetch_data(true, "GET", "http://127.0.0.1:5000/apiv1/test/getQuestions?mac_id=1", render_questions);
		} else {
			alert("你还没有完成视频观看或者说明阅读要求!\n通过点击用户头像可以查看当前完成状态.");
			setTimeout(function (e) {
				nav_btns[0].click();
			}, 500);
			return;
		}
	}

	/**
  * 渲染试题页面
  * @param  {[type]} res [description]
  * @return {[type]}     [description]
  */
	function render_questions(res) {
		if (res['code'] == -1) {
			alert("抓取后台题库错误!");
			return;
		}
		var raw_data = res['data'];
		var html = "";
		var question_no = 1;
		for (var _i16 = 0; _i16 < raw_data.length; _i16++) {
			var question_item = raw_data[_i16];
			var selection_no = 1;
			// 渲染题目
			html += "<div class=\"question_item\" data-id=\"" + question_item['qid'] + "\">\n\t\t\t\t<div class=\"question_title\">\n\t\t\t\t\t<p style=\"display: flex;\">" + question_item['question'] + "</p>\n\t\t\t\t</div>\n\t\t\t\t<div class=\"question_radio\">";
			// 渲染选项
			for (var j = 0; j < question_item['selections'].length; j++) {
				var selection = question_item['selections'][j];
				html += "<p><input type=\"radio\" data-role=\"" + selection_no + "\" class=\"answer_radio\"><label>" + selection + "</label></p>";
				selection_no += 1;
			}
			// 闭合标签
			html += "</div></div>";
			question_no += 1;
		}
		question_section.innerHTML = html;
		bind_radio();
		test_control_area.style['display'] = "flex";
	}

	/**
  * 视频播放和暂停的切换函数
  * @param  {[type]} button [description]
  * @return {[type]}        [description]
  */
	function toggle_play() {
		state = video.paused;
		if (state) {
			video.play();
			play_btn.innerHTML = "暂停";
		} else {
			video.pause();
			play_btn.innerHTML = "播放";
		}
	}

	/**
  * 用于注册和登录输入框的切换, 事实上他们共用输入框
  * @param  {[type]} role [description]
  * @return {[type]}      [description]
  */
	function panel_switch(role) {
		clear_login();
		submit_login.setAttribute("data-action", role);
		for (var _i17 = 0; _i17 < login_part.length; _i17++) {
			var part = login_part[_i17];
			part.style["display"] = role == "login" ? "none" : "block";
		}
	}

	/**
  * 按钮样式切换
  * @param  {[type]} selected_btn [description]
  * @return {[type]}              [description]
  */
	function btn_switch(selected_btn) {
		for (var _i18 = 0; _i18 < nav_btns.length; _i18++) {
			var _btn2 = nav_btns[_i18];
			_btn2.setAttribute("class", "nav_btn");
		}
		selected_btn.setAttribute("class", "nav_btn selected");
	}

	/**
 * 向服务端请求的统一接口函数
 * @param  {[type]}   method   Ajax方法
 * @param  {[type]}   url      请求的接口地址
 * @param  {Function} callback 收到请求的回调函数
 * @param  {[type]}   data     POST的数据--类型:对象
 * @param  {[type]}   error_callback 出现错误的时候调用的函数
 */
	function fetch_data(block, method, url, callback, data, error_callback) {
		if (block) {
			toggle_loading(1);
		}
		var xhr = new XMLHttpRequest();
		xhr.open(method, url);
		xhr.timeout = 9000;
		if (method === "POST") {
			xhr.setRequestHeader("Content-Type", 'application/x-www-form-urlencoded');
		}
		xhr.send(unescape(data));
		xhr.ontimeout = function (e) {
			if (block) toggle_loading(0);
			alert("错误(000T)! 请求超时,请检查网络连接.");
			if (error_callback) error_callback(xhr);
		};
		xhr.onerror = function (e) {
			if (block) toggle_loading(0);
			alert("出现错误(000U)! 技术人员请参考控制台输出.");
			console.log(xhr.status + "<->" + xhr.statusText);
			if (error_callback) {
				error_callback(xhr);
			}
		};
		xhr.onreadystatechange = function () {
			if (xhr.readyState == 4 && xhr.status == 200) {
				//成功fetch到数据
				if (block) toggle_loading(0);
				try {
					var res = JSON.parse(xhr.response);
				} catch (e) {
					alert("错误! 后台结果异常(000J)");
				}
				return callback(res);
			}
		};
	}

	window.fetch_data = fetch_data; // 全局绑定

	/**
  * 执行登录或者注册操作, 由当前显示的输入信息决定执行哪一个操作
  * 都会先进行各自的填充本地验证, 接着组装信息 将他们发送.
  * 增加了敏感字符和SQL关键字的过滤
  * @param  {[type]} abs_login [description]
  * @return {[type]}           [description]
  */
	function do_login_or_register(abs_login) {
		var role = abs_login || submit_login.dataset['action'] || document.getElementsByClassName("current_action")[0].dataset['role'];
		var form = new Map();
		if (role == 'register') {
			// 填充验证
			for (var _i19 = 1; _i19 < login_panel.childElementCount - 1; _i19++) {
				// 长度验证
				if (_i19 == 1 || _i19 == 4) {
					if (login_panel.children[_i19].value.length < 5) {
						alert(login_panel.children[_i19].placeholder + "长度要大于5");
						return;
					}
				}
				if (login_panel.children[_i19].value === "") {
					alert(login_panel.children[_i19].placeholder + "不能为空");
					return;
				}
				// 敏感字符过滤
				if (validate(login_panel.children[_i19].value) && filterSqlStr(login_panel.children[_i19].value)) {
					form.set(login_panel.children[_i19].name, login_panel.children[_i19].value);
				} else {
					login_panel.children[_i19].value = "";
					return;
				}
			}
			// 密码验证
			if (login_part[2].value != login[1].value) {
				alert("两次输入的密码不一致");
				login_part[2].value = "";
				login[1].value = "";
				return;
			}
			form.delete("passwd_validate");
			if (admin_state == "users") {
				form.set("token", localStorage.getItem("token"));
				form.set("state", admin_state);
			}
			// 注册信息组装
			data = make_data(form);
			// 发送注册请求
			fetch_data(true, "POST", "http://127.0.0.1:5000/apiv1/user/doSignin", check_register_state, data, toggle_login);
		} else {
			// 填充验证
			for (var _i20 = 0; _i20 < login.length; _i20++) {
				var ele = login[_i20];
				if (ele.value == "") {
					alert(ele.placeholder + "不能为空");
					return;
				}
				if (validate(ele.value) && filterSqlStr(ele.value)) {
					form.set(ele.name, ele.value);
				} else {
					ele.value = "";
					return;
				}
			}
			// 登录信息组装
			data = make_data(form);
			// 发送登录请求
			fetch_data(true, "POST", "http://127.0.0.1:5000/apiv1/user/doLogin", check_login_state, data, toggle_login);
		}
	}

	/**
  * 检查注册状态函数
  * @param  {[type]} res [description]
  * @return {[type]}     [description]
  */
	function check_register_state(res) {
		if (res['code'] == '0') {
			// 注册成功
			// admin特例处理
			if (res['api']) {
				toggle_login(0);
				render_admin(res['api']);
				return;
			}
			// 如果不是在管理界面, 就直接登陆了
			do_login_or_register("login");
			toggle_login(0);
		}
		if (res['code'] == '-1') {
			// 后台数据库写入失败
			alert("注册失败! 后台数据写入异常! 请重试.");
			mask.style['display'] = "block";
		}
		if (res['code'] == '-4') {
			alert("注册失败! 用户名已经被注册了!");
			mask.style['display'] = "block";
			login[0].value = "";
		}
	}

	/**
  * 检查登录状态函数
  * @param  {[type]} res [description]
  * @return {[type]}     [description]
  */
	function check_login_state(res) {
		if (res['code'] == '0') {
			// 登陆成功
			username = res['username'];
			greeting.innerHTML = "欢迎," + res['truename'];
			access = 1;
			toggle_login(0);
			fetch_data(true, "GET", "http://127.0.0.1:5000/apiv1/user/fetchInfo?username=" + escape(username), record_init, null);
		}
		if (res['code'] == '1') {
			// 密码错误
			alert("登录失败! 密码错误!");
			mask.style['display'] = "block";
		}
		if (res['code'] == '2') {
			// 用户不存在
			alert("登录失败! 用户不存在!");
			mask.style['display'] = "block";
		}
		if (res['code'] == '3') {
			// 用户账户被冻结
			alert("登录失败! 用户账户被冻结, 请联系管理员激活!");
			mask.style['display'] = "block";
		}
	}

	/**
  * 验证登出状态函数
  * @param  {[type]} res [description]
  * @return {[type]}     [description]
  */
	function check_logout_state(res) {
		if (res['code'] == "0") {
			greeting.innerHTML = "请先登录!";
			access = 0;
			max_view = 0;
			max_viewtime = 0;
			selected_pdf = null;
			logout_btn.blur();
		} else {
			alert("登出失败! 请稍后尝试.");
			max_view = 0;
			max_viewtime = 0;
		}
	}

	/**
  * 登出操作
  * @return {[type]} [description]
  */
	function logout() {
		if (confirm("确定登出?\n你的信息(包括测试)不会被保存!")) {
			intest = 0;
			data = "username=" + username;
			fetch_data(true, "POST", "http://127.0.0.1:5000/apiv1/user/doLogout", check_logout_state, data);
			toggle_tooltip(0);
			nav_btns[0].click();
		}
		return;
	}

	/**
  * Map转换函数, 返回字符串
  * @param  {[type]} form [description]
  * @return {[type]}      [description]
  */
	function make_data(form) {
		data = "";
		form.forEach(function (v, k) {
			data += k;
			data += "=";
			data += v;
			data += "&";
		});
		data = data.substr(0, data.length - 1);
		return data;
	}

	/**
  * 非法字符的检测函数
  * @param  {[type]} value [description]
  * @return {[type]}       [description]
  */
	function validate(value) {
		var pattern = /[`~!#$%^&*()_+<>?:"{},\/;'[\]]/im;
		if (value === '' || value === null) return false;
		if (pattern.test(value)) {
			alert("包含非法字符!");
			return false;
		}
		return true;
	}

	/**
  * 敏感字符的检测函数(数据库)
  * @param  {[type]} value [description]
  * @return {[type]}       [description]
  */
	function filterSqlStr(value) {
		var str = "and,delete,or,exec,insert,select,union,update,count,*,',join,>,<";
		var sqlStr = str.split(',');
		var flag = true;
		for (var i = 0; i < sqlStr.length; i++) {
			if (value.toLowerCase().indexOf(sqlStr[i]) != -1) {
				alert("包含非法字符!");
				flag = false;
				break;
			}
		}
		return flag;
	}

	/**
 * 负责切换菜单点击后模块切换的统一接口
 * @param  {[type]}   e          鼠标点击事件
 * @param  {[type]}   selected_btn  目标按钮
 * @param  {[type]}   toView        目标视图
 * @param  {Function} callback      回调函数
 */
	function menu_switch(e, selected_btn, toView, callback) {
		if (!access) {
			alert("你还没有登录");
			toggle_login(1);
			return;
		}
		e.cancelBubble = true;
		btn_switch(selected_btn);
		if (!video.paused) toggle_play();
		curView.style.transform = "translate3d(-150%,0,0)";
		curView.style.opacity = 0;
		toView.style.display = "flex";
		toView.style.transition = "all 0.8s";
		toView.style.transform = "translate3d(0,0,0)";
		if (callback) callback();
		setTimeout(function () {
			toView.style.opacity = 1;
			curView = toView;
		}, 400); // 总觉得这里这样不是很安全, 后期再考虑
	}

	/**
  * toggle加载动画和覆盖层
  * @param  {[type]} toggle [description]
  * @return {[type]}        [description]
  */
	function toggle_loading(toggle) {
		mask.style['display'] = toggle == "1" ? "block" : "none";
		if (toggle == "1") {
			maskmask.style['display'] = "block";
			canvas.style['transform'] = "scale3d(1, 1, 1)";
			loading_timer = requestAnimationFrame(render_loading);
		} else {
			maskmask.style['display'] = "none";
			cancelAnimationFrame(loading_timer);
			canvas.style['transform'] = "scale3d(0, 0, 0)";
		}
	}

	/**
  * toggle加载登录注册面板和覆盖层
  * @param  {[type]} toggle [description]
  * @return {[type]}        [description]
  */
	function toggle_login(toggle, register_only) {
		mask.style['display'] = toggle == "1" ? "block" : "none";
		for (var _i21 = 0; _i21 < action_switch.children.length; _i21++) {
			var switcher = action_switch.children[_i21];
			switcher.style.display = "block";
		}
		if (toggle == "1") {
			login_panel.style['transform'] = "translate3d(0, 0, 0)";
			mask.addEventListener("click", toggle_login);
		} else {
			login_panel.style['transform'] = "translate3d(0, -250%, 0)";
			mask.removeEventListener("click", toggle_login);
		}
		if (register_only) {
			action_switch.children[0].click(); // 点击注册按钮切换
			for (var j = 0; j < action_switch.children.length; j++) {
				var _switcher = action_switch.children[j];
				_switcher.style.display = "none";
			}
		}
		clear_login();
	}

	/**
  * 清空输入框
  * @return {[type]} [description]
  */
	function clear_login() {
		for (var _i22 = 1; _i22 < login_panel.childElementCount - 1; _i22++) {
			login_panel.children[_i22].value = "";
		}
	}

	function record_init(res) {
		time_record = Math.ceil(res.userstate[1] / 60);
	}

	/**
  * toggle用户个人信息的函数
  * @param  {[type]} toggle [description]
  * @return {[type]}        [description]
  */
	function toggle_tooltip(toggle) {
		if (toggle == "1") {
			fetch_data(true, "GET", "http://127.0.0.1:5000/apiv1/user/fetchInfo?username=" + escape(username), fill_user_info, null, toggle_tooltip);
			tooltip.style['transform'] = "translate3d(0, 0, 0)";
			// 由于这里需要调用toggle_loading 会导致mask消失
			// 所以需要在后面调用
			mask.addEventListener("click", toggle_tooltip);
		} else {
			tooltip.style['transform'] = "translate3d(0, -300%, 0)";
			mask.removeEventListener("click", toggle_tooltip);
			mask.style['display'] = "none";
		}
	}

	var items = document.getElementsByClassName("tip_value");
	/**
  * 用户登录之后填充tooltip信息
  * @param  {[type]} res [description]
  * @return {[type]}     [description]
  */
	function fill_user_info(res) {
		time_record = Math.ceil(res.userstate[1] / 60);
		mask.style['display'] = "block";
		tooltip.children[0].innerHTML = "\u4F60\u597D," + res['truename'] + "<span id=\"cancel_tooltip\">\xD7</span>";
		var cancel_tooltip = document.getElementById("cancel_tooltip");
		cancel_tooltip.addEventListener("click", function (e) {
			toggle_tooltip(0);
		});
		// for (let i = 0; i < items.length; i ++) {
		// 	items[i].innerHTML = res.userstate[i] + "/" + res.requirement[i]
		// }
		items[0].innerHTML = "\u5DF2\u89C2\u770B" + res.userstate[0] + ", \u9700\u8981" + res.requirement[0] + "\u4E2A";
		items[1].innerHTML = "\u5DF2\u9605\u8BFB" + Math.ceil(res.userstate[1] / 60) + "\u5206\u949F";
		items[2].innerHTML = res.userstate[2] + "\u5206, \u9700\u8981\u5F97\u5230" + res.requirement[2] + "\u5206";
		if (res.userstate[3] == "0") {
			items[2].innerHTML = '还未参加测评';
		}
	}

	/**
  * 加载动画渲染函数
  * @return {[type]} [description]
  */
	function render_loading() {
		context.clearRect(0, 0, canvas.width, canvas.height);
		context.strokeStyle = "rgb(49, 71, 74)";
		context.lineWidth = 10;
		context.beginPath();
		context.arc(canvas.width / 2, canvas.height / 2, canvas.width / 3, start_angle, start_angle + Math.PI * 1.3);
		context.stroke();
		context.lineWidth = 1;
		context.font = "30px SimHei";
		context.textAlign = "center";
		context.strokeText("加载中", canvas.width / 2, canvas.height / 2);
		start_angle += 0.1;
		start_angle %= Math.PI * 2; // 防止数值太大
		loading_timer = requestAnimationFrame(render_loading);
	}

	/**
  * 统一处理管理页面的渲染的入口函数
  * @param  {[type]} api [description]
  * @return {[type]}     [description]
  */
	function render_admin(api) {
		fetch_data(true, "POST", "http://127.0.0.1:5000/apiv1" + api, _render_admin, "token=" + localStorage.getItem("token"));
	}

	/**
  * 检查及格线设置是否成功
  * @param  {[type]} res [description]
  * @return {[type]}     [description]
  */
	function check_setpass_state(res) {
		if (res['code'] == 0) {
			alert("修改成功!");
			toggle_admin_inputbox(false);
		} else alert("修改失败!");
	}

	/**
  * toggle及格线输入窗口
  * @param  {[type]} toggle [description]
  * @return {[type]}        [description]
  */
	function toggle_admin_inputbox(toggle) {
		admin_input.children.pass.value = "";
		if (toggle) admin_inputbox.style['transform'] = "scale3d(1,1,1)";else admin_inputbox.style['transform'] = "scale3d(0,0,0)";
	}

	function access_test(res) {
		if (!res['access']) {
			if (res['code'] == -1) alert("密钥过期! 请重新进入管理页面!");
			if (res['code'] == -2) alert("密钥错误! 请尝试重新登录!");
			return false;
		}
		return true;
	}

	var desc_area_head = document.getElementsByClassName("desc_area_head")[0];
	var desc_area_body = document.getElementsByClassName("desc_area_body")[0];
	/**
  * 渲染管理界面的函数, 除了用户单独处理, 其他的都使用统一渲染方式
  * @param  {[type]} res [description]
  * @return {[type]}     [description]
  */
	function _render_admin(res) {
		search_bar.value = "";
		desc_area_head.children[1].innerHTML = "";
		desc_area_body.children[1].innerHTML = "";
		if (!access_test(res)) return;
		action = res['attr'];
		if (action == "users") {
			rule = [3, 5, 13, 10, 25, 10, 10, 24];
		}
		if (action == "videos") {
			rule = [3, 10, 20, 10];
		}
		if (action == "instructions") {
			rule = [3, 10, 20, 10];
		}
		if (action == "tests") {
			rule = [3, 5, 35, 35, 17];
		}
		if (action == "reminders") {
			rule = [3, 5, 35, 10];
		}
		// 填充位置约束的colgroup
		rule_ele = "";
		for (var _i23 = 0; _i23 < rule.length; _i23++) {
			rule_ele += "<col style=\"width: " + rule[_i23] + "%\">";
		}
		desc_area_head.children[0].innerHTML = rule_ele;
		desc_area_body.children[0].innerHTML = rule_ele;
		// 填充title
		title_ele = "<tr><th><input type=\"checkbox\" data-action=\"all\" class=\"admin_checkbox admin_checkbox_all\"></th>";
		for (var j = 0; j < res['title'].length; j++) {
			title_ele += "<th>" + res['title'][j] + "</th>";
		}
		title_ele += "</tr>";
		desc_area_head.children[1].innerHTML = title_ele;
		// 填充具体的表格
		if (action == "users") {
			main_ele = "";
			for (var _i24 = 0; _i24 < res['data'].length; _i24++) {
				var user = res['data'][_i24];
				main_ele += "<tr class=\"item_row\" data-key=\"" + user['info'][1] + "\"><td><input type=\"checkbox\" data-name=\"\" class=\"admin_checkbox\"></td>";
				// 先填充前面的用户信息
				for (var m = 0; m < user['info'].length; m++) {
					value = user['info'][m];
					if (m == 4 || m == 5) {
						value = user['info'][m] == 1 ? "是" : "否";
					}
					main_ele += "<td>" + value + "</td>";
				}
				// 再填充后面的用户状态
				main_ele += "<td><div><p>\u89C6\u9891\u89C2\u770B: " + user['state'][0] + "/" + res['require'][0] + "</p><p>\u8BF4\u660E\u9605\u8BFB: " + user['state'][1] + "/" + res['require'][1] + "</p>";
				if (user['state'][3] == 0) main_ele += "<p>尚未参加测评</p></div>";else main_ele += "<p>\u6D4B\u8BC4\u6210\u7EE9: " + user['state'][2] + "/" + res['require'][2] + "<p></div>";
				main_ele += "<button class=\"op_btn sp_btn\" data-role=\"" + user['info'][1] + "\">\u6D4B\u8BC4\u62A5\u544A</button>";
				main_ele += "</tr>";
			}
			desc_area_body.children[1].innerHTML = main_ele;
			// disable设置及格线按钮
			for (var _btn3 = 0; _btn3 < action_btns.length; _btn3++) {
				action_btns[_btn3].setAttribute("class", "action_btn");
			}
			action_btns[6].setAttribute("class", "action_btn action_disable");
			bind_checkbox();
			bind_sp();
			return;
		}
		main_ele = "";
		for (var item = 0; item < res['data'].length; item++) {
			main_ele += "<tr class=\"item_row\" data-key=\"" + res['data'][item][0] + "\"><td><input type=\"checkbox\" data-action=\"\" class=\"admin_checkbox\"></td>";
			main_ele += "<td>" + (item + 1) + "</td>";
			if (action == "tests") {
				for (var n = 1; n < res['data'][item].length; n++) {
					if (n == 2) {
						main_ele += "<td><div>";
						for (var _i25 = 0; _i25 < res['data'][item][n].length; _i25++) {
							var selection = res['data'][item][n][_i25];
							main_ele += "<p>" + selection + "</p>";
						}
						main_ele += "</div></td>";
					} else {
						main_ele += "<td>" + res['data'][item][n] + "</td>";
					}
				}
			} else {
				for (var _n = 0; _n < res['data'][item].length; _n++) {
					main_ele += "<td>" + res['data'][item][_n] + "</td>";
				}
			}
			if (action == "reminders") {
				main_ele += "<td><button class=\"op_btn\">\u4FEE\u6539</button></td>";
			}
			main_ele += "</tr>";
		}
		desc_area_body.children[1].innerHTML = main_ele;
		if (admin_state == "reminders") desc_area_body.children[1].getElementsByTagName("button")[0].onclick = changereminder;
		if (action == "reminders") {
			for (var _btn4 = 0; _btn4 < action_btns.length; _btn4++) {
				action_btns[_btn4].setAttribute("class", "action_btn action_disable");
			}
			return;
		}
		// 调整上方操作按钮
		for (var _btn5 = 0; _btn5 < action_btns.length; _btn5++) {
			action_btns[_btn5].setAttribute("class", "action_btn");
			if (_btn5 >= 2 && _btn5 <= 5) action_btns[_btn5].setAttribute("class", "action_btn action_disable");
		}
		bind_checkbox();
		return;
	}

	/**
  * 绑定勾选框的事件绑定, 是动态绑定的
  * @return {[type]} [description]
  */
	function bind_checkbox() {
		box = document.getElementsByClassName("admin_checkbox_all")[0];
		boxes = document.getElementsByClassName("admin_checkbox");
		for (var b = 1; b < boxes.length; b++) {
			boxes[b].addEventListener("click", function (e) {
				for (var _b = 1; _b < boxes.length; _b++) {
					if (!boxes[_b].checked) {
						box.checked = false;
						return;
					}
				}
				box.click();
			});
		}
		box.addEventListener("click", function (e) {
			for (var _b2 = 1; _b2 < boxes.length; _b2++) {
				boxes[_b2].checked = box.checked;
			}
		});
	}

	function bind_sp() {
		var btns = document.getElementsByClassName("sp_btn");
		for (var _i26 = 0; _i26 < btns.length; _i26++) {
			var _btn6 = btns[_i26];
			_btn6.addEventListener("click", function (e) {
				e.preventDefault();
				var t = e.target || e.srcElement;
				toggle_result(true, t.dataset['role']);
			});
		}
	}

	/**
  * 尝试抓取所有的checkbox元素所在的那一行的data-key
  * @return {[type]} [description]
  */
	function check_target() {
		var result = [];
		var boxes = document.getElementsByClassName("admin_checkbox");
		if (boxes.length == 0) return result;
		if (boxes[0].checked) {
			eles = document.getElementsByClassName("item_row");
			for (var _i27 = 0; _i27 < eles.length; _i27++) {
				var ele = eles[_i27];
				result.push(ele.dataset['key']);
			}
		} else {
			for (var _i28 = 1; _i28 < boxes.length; _i28++) {
				if (boxes[_i28].checked) {
					result.push(boxes[_i28].parentElement.parentElement.dataset['key']);
				}
			}
		}
		return result;
	}

	/**
  * toggle上传页面的窗口
  * @param  {[type]} toggle [description]
  * @return {[type]}        [description]
  */
	function toggle_upload(toggle) {
		if (toggle) {
			if (admin_state == "tests") {
				alert("上传带有图片的题目的上传方法:\n格式同文本上传, 在需要图片的题目加上:\n[img:这里写图片的名字]\n即可.\n注意:图片和题目必须一起上传! 且需要确保上传的图片名和题目中的标签保持一致.");
			}
			admin_uploadbox.style['transform'] = "scale3d(1,1,1)";
		} else {
			files = [];
			if (send_queue.length == 0) preview_area.innerHTML = "";
			admin_uploadbox.style['transform'] = "scale3d(0,0,0)";
		}
	}

	/**
  * 管理通用, 检查删除操作状态的回调函数
  * @param  {[type]} res [description]
  * @return {[type]}     [description]
  */
	function check_del_state(res) {
		if (!access_test(res)) return;
		if (res['code'] == 0) {
			alert("删除操作执行成功!\n如有需要, 请调整及格线!");
			render_admin(res['api']);
		} else {
			alert("删除操作执行失败!");
		}
	}

	/**
  * 执行action代理函数, 由此来召唤不同的函数
  * @param  {[type]} action [description]
  * @return {[type]}        [description]
  */
	function do_action(action) {
		target = check_target();
		// 我们这里进行分开处理, 由于用户的操作比较多, 并且全部都涉及数据库操作, 因此单独拿出来
		if (admin_state == "users") {
			do_user_action(target, action);
		} // 而对于其他的state,比较统一,都是新增(文件上传)和删除(后台删除文件)的操作, 所以放在一起
		else {
				if (action == "new") {
					if (admin_state == "tests") {
						toggle_new_question(true);
						return;
					}
					toggle_upload(true);
				}
				if (action == "del") {
					if (target.length == 0) {
						alert("你还没有选择任何项目!");
						return;
					}
					if (confirm("确定删除下面的项目吗?\n" + target)) {
						var _data2 = new Map();
						_data2.set("token", localStorage.getItem("token"));
						_data2.set("username", username);
						_data2.set("state", admin_state);
						_data2.set("target", target);
						_data2 = make_data(_data2);
						fetch_data(true, "POST", "http://127.0.0.1:5000/apiv1/admin/del", check_del_state, _data2);
					} else return;
				}
			}
	}

	/**
  * 用户操作的执行函数, 新增, 删除, 冻结, 激活和授权
  * @param  {[type]} target [description]
  * @param  {[type]} action [description]
  * @return {[type]}        [description]
  */
	function do_user_action(target, action) {
		// 创建新用户
		if (action == "new") {
			toggle_login(1, true);
			return;
		}
		// 用户搜索
		if (action == "search") {
			var _username = search_bar.value;
			search_bar.value = "";
			if (_username.legnth == 0) return;
			if (filterSqlStr(_username) && validate(_username)) {
				var _data3 = new Map();
				_data3.set("query", _username);
				_data3.set("token", localStorage.getItem("token"));
				_data3.set("state", admin_state);
				_data3 = make_data(_data3);
				fetch_data(true, "POST", "http://127.0.0.1:5000/apiv1/admin/searchUser", re_renderuser, _data3);
			}
			return;
		}
		var data = new Map();
		target = check_target();
		if (target.length == 0) {
			alert("你还没有选择任何用户");
			return;
		}
		data.set("token", localStorage.getItem("token"));
		data.set("targets", target);
		data.set("user", username);
		data.set("state", admin_state);
		data = make_data(data);
		// 删除用户
		if (action == "del") {
			if (target.includes(username)) {
				alert("你不能删除自己! 请去除对当前用户的选择.");
				return;
			}
			if (confirm("确定删除下面的用户?\n⚠️警告!删除后将不可恢复!\n\n" + target)) {
				fetch_data(true, "POST", "http://127.0.0.1:5000/apiv1/user/delUser", check_del_state, data);
			}
			return;
		}
		// 冻结用户
		if (action == "deactive") {
			if (confirm("是否冻结下面的用户?\n警告⚠️!同时会收回用户的管理员权限!\n\n" + target)) {
				fetch_data(true, "POST", "http://127.0.0.1:5000/apiv1/user/deactiveUser", check_admin_state, data);
			}
			return;
		}
		// 激活用户
		if (action == "active") {
			if (confirm("确定激活下面的用户?\n\n" + target)) {
				fetch_data(true, "POST", "http://127.0.0.1:5000/apiv1/user/activeUser", check_admin_state, data);
			}
			return;
		}
		// 授权用户成为管理员
		if (action == "grant") {
			if (confirm("确定授权下面的用户?\n警告⚠️!管理员权限很大!\n\n" + target)) {
				fetch_data(true, "POST", "http://127.0.0.1:5000/apiv1/user/grantUser", check_admin_state, data);
			}
			return;
		}
		// 取消用户授权
		if (action == "ungrant") {
			if (confirm("确定对下面的用户收回授权?\n\n" + target)) {
				fetch_data(true, "POST", "http://127.0.0.1:5000/apiv1/user/ungrantUser", check_admin_state, data);
			}
		}
	}

	function re_renderuser(res) {
		if (res['code'] == 233) {
			alert("搜索不到这个用户");
		} else {
			_render_admin(res);
		}
	}

	/**
  * 处理管理功能操作的统一处理结果回调函数
  * @param  {[type]} res [description]
  * @return {[type]}     [description]
  */
	function check_admin_state(res) {
		if (!access_test(res)) return;
		render_admin(res['api']);
		if (res['code'] == 0) alert("操作成功!");else alert("操作失败!请稍后重试!");
	}

	/**
  * 简单的前端文件后缀检查和大小check
  * @param  {[type]} filelist [description]
  * @param  {[type]} state    [description]
  * @return {[type]}          [description]
  */
	function check_files(filelist, state) {
		type = "";
		if (state == "videos") {
			type = ["video/mp4"];
		} else if (state == "instructions") {
			type = ["application/pdf"];
		} else if (state == "tests") {
			type = ["text/plain", "image/png", "image/jpeg", "image/jpg", "image/bmp", "image/gif"];
		}
		for (var _i29 = 0; _i29 < filelist.length; _i29++) {
			var file = filelist[_i29];
			if (!type.includes(file.type)) return file.name;
			if (file.size >= 209715200) return file.name; // 文件大于200MB, 拒绝
		}
		return false;
	}

	/**
  * 渲染文件上传列表
  * @param  {[type]} filelist [description]
  * @return {[type]}          [description]
  */
	function render_previewlist(filelist) {
		html = "";
		for (var _i30 = 0; _i30 < filelist.length; _i30++) {
			var file = filelist[_i30];
			html += "<div class=\"file_item\"><span class=\"file_name\">" + file.name + "</span><span class=\"upload_state\">\u7B49\u5F85\u4E2D</span></div>";
		}
		preview_area.innerHTML = html;
	}

	/**
  * 上传的任务提交函数, 并不真正执行上传
  * @param  {[type]} btn [description]
  * @return {[type]}     [description]
  */
	function do_upload(btn) {
		btn.setAttribute("disabled", "disabled");
		admin_upload_btns[0].setAttribute("disabled", "disabled");
		var labels = document.getElementsByClassName("upload_state");
		if (files.length == 0) {
			alert("请选择文件!");
			admin_upload_btns[0].removeAttribute("disabled");
			btn.removeAttribute("disabled");
			return;
		}
		for (var _i31 = 0; _i31 < labels.length; _i31++) {
			upload_file(files[_i31], labels[_i31]);
		}
		files = [];
		btn.removeAttribute("disabled");
	}

	/**
  * 文件上传的函数, 使用FileReader API将文件读取成为二进制流发送
  * 会先发送一个OPTIONS请求使用POST
  * @param  {[type]} file  [description]
  * @param  {[type]} label [description]
  * @return {[type]}       [description]
  */
	function upload_file(file, label) {
		var xhr = new XMLHttpRequest();
		var reader = new FileReader();
		xhr.open("POST", "http://127.0.0.1:5000/apiv1/admin/upload?state=" + admin_state + "&token=" + localStorage.getItem("token") + "&filename=" + file.name, true);
		reader.onerror = function (e) {
			label.innerHTML = "读取失败";
		};
		reader.onload = function (e) {
			label.innerHTML = "读取完成";
			// 读取完成, 加入到发送队列当中, 然后开始串行发送
			send_queue.push([xhr, new Uint8Array(reader.result)]);
			if (send_queue.length == preview_area.childElementCount) {
				_upload();
			}
		};
		reader.readAsArrayBuffer(file);
		xhr.onerror = function (e) {
			console.log(xhr.status + "<->" + xhr.statusText);
			// 渲染列表
			label.innerHTML = "上传失败";
			_upload();
		};
		xhr.upload.onprogress = function (e) {
			var percent = Math.floor(e.loaded / e.total * 100);
			label.innerHTML = "\u4E0A\u4F20\u4E2D " + percent + "%";
			if (percent == 100) {
				label.innerHTML = "上传完成";
			}
		};
		xhr.onreadystatechange = function () {
			if (xhr.readyState == 4 && xhr.status == 200) {
				try {
					var res = JSON.parse(xhr.response);
					if (!access_test(res)) return;
					if (res['api']) render_admin(res['api']);
					_upload();
				} catch (e) {
					alert("错误! 后台结果异常(000J)");
				}
			}
		};
	}

	/**
  * 文件上传的类消息队列实现, 很蠢的
  * @return {[type]} [description]
  */
	function _upload() {
		if (send_queue == 0) {
			admin_upload_btns[0].removeAttribute("disabled");
			alert("文件全部上传结束!");
			toggle_upload(false);
			return;
		}
		var sender = send_queue.shift();
		sender[0].send(sender[1]);
	}

	/**
  * toggle手动录入题目窗口
  * @param  {[type]} toggle [description]
  * @return {[type]}        [description]
  */
	function toggle_new_question(toggle) {
		if (toggle) {
			var holder = "\u76EE\u524D\u4EC5\u652F\u6301\u9009\u62E9\u9898\u578B, \u9700\u6309\u7167\u4E0B\u9762\u683C\u5F0F\u8FDB\u884C\u6DFB\u52A0(\u6279\u91CF\u4E0A\u4F20\u540C\u53C2\u8003\u6B64\u683C\u5F0F), \u6B64\u65B9\u5F0F\u4EC5\u652F\u6301\u7EAF\u6587\u672C\u7684\u9898\u76EE, \u5982\u679C\u9700\u8981\u4E0A\u4F20\u5E26\u6709\u56FE\u7247\u7684\u9898\u76EE, \u8BF7\u4F7F\u7528\u6587\u4EF6\u4E0A\u4F20\u529F\u80FD\n\n\u8FD9\u662F\u4E00\u4E2A\u9898\u76EE, \u9898\u76EE\u4E0D\u8981\u6362\u884C, \u9898\u53F7\u4E0D\u7528\u5199\n\u9009\u9879\u53EF\u4EE5\u4E0D\u7528\u5199ABC\u8FD9\u4E9B, \u8FD9\u662F\u7B2C\u4E00\u4E2A\u9009\u9879\n\u8FD9\u662F\u9009\u9879B, \u9519\u8BEF\u7B54\u6848\n* \u8FD9\u662F\u6B63\u786E\u7B54\u6848, \u6B63\u786E\u7B54\u6848\u524D\u9762\u6709\u4E00\u4E2A\u661F\u53F7\n\u8FD9\u662F\u9009\u9879D, \u9519\u8BEF\u7B54\u6848\n\n\u4E0D\u540C\u9898\u76EE\u4E4B\u95F4\u4EC5\u4F7F\u7528\u4E00\u4E2A\u7A7A\u884C\u8FDB\u884C\u5206\u5272.\n* \u8FD9\u662F\u7B2C\u4E00\u4E2A\u9009\u9879\n\u8FD9\u662F\u9009\u9879B, \u672C\u9898\u53EA\u6709\u4E24\u4E2A\u9009\u9879";
			question_input.value = "";
			question_input.setAttribute("placeholder", holder);
			question_box.style['transform'] = "scale3d(1,1,1)";
		} else {
			question_box.style['transform'] = "scale3d(0,0,0)";
		}
	}

	/**
  * 解析用户输入的文本串, 简单的格式检查
  * @return {[type]} [description]
  */
	function check_struct(raw_data) {
		var result = [];
		var questions = raw_data.split(/\n(\n)*\n/);
		for (var _i32 = 0; _i32 < questions.length; _i32++) {
			var q = questions[_i32];
			flag = false;
			if (q && q !== "\n") {
				for (var j = 0; j < q.split("\n").length; j++) {
					var s = q.split("\n")[j];
					if (s.startsWith("*")) flag = true;
				}
				if (!flag) return [];
				result.push(q);
			}
		}
		return result;
	}

	/**
  * 执行一系列的确定和上传工作
  * @return {[type]} [description]
  */
	function confirm_new_question() {
		var question_data = check_struct(question_input.value);
		if (question_data.length == 0) {
			alert("试题格式有问题或者长度为0!");
			return;
		}
		// 发送data
		fetch_data(true, "POST", "http://127.0.0.1:5000/apiv1/admin/newQuestions", check_confirm_state, "state=" + admin_state + "&data=" + question_input.value);
	}

	function check_confirm_state(res) {
		if (res['code'] == 0) {
			toggle_new_question(false);
			render_admin(res['api']);
		} else {
			alert("上传出错!");
			toggle_new_question(false);
		}
	}

	function switch_questionbox() {
		toggle_new_question(false);
		toggle_upload(true);
	}

	/**
  * 检查用户是否有资格进行测试
  * @return {[type]} [description]
  */
	function check_haveaccess2test() {
		fetch_data(true, "GET", "http://127.0.0.1:5000/apiv1/user/canTest?user=" + username, fetch_questions);
	}

	/**
  * 选择选项的点击事件绑定函数, 由于是动态生成的, 因此采用lazy绑定的模式啦
  * @param  {[type]} radio [description]
  * @return {[type]}       [description]
  */
	function bind_radio() {
		var radios = document.getElementsByClassName("answer_radio");
		for (var _i33 = 0; _i33 < radios.length; _i33++) {
			var radio = radios[_i33];
			radio.addEventListener("click", function (e) {
				intest = 1;
				var t = e.target || e.srcElement;
				var block = t.parentElement.parentElement;
				for (var j = 0; j < block.children.length; j++) {
					var p = block.children[j];
					p.children[0].checked = false;
				}
				t.checked = true;
				block.dataset['selected'] = t.dataset['role'];
			});
		}
	}

	/**
  * 提交答案
  * @return {[type]} [description]
  */
	function submit_answer() {
		if (confirm("确定提交答案?")) {
			intest = 0;
			var _items = question_section.children;
			user_pack = [];
			for (var _i34 = 0; _i34 < _items.length; _i34++) {
				var item = _items[_i34];
				var tmp = [item.dataset['id']];
				var ans = item.children[1].dataset['selected'];
				if (ans) {
					tmp.push(ans);
				} else {
					intest = 1;
					alert("你还有没有完成的题目!\n请全部完成之后再提交");
					return;
				}
				user_pack.push(tmp);
			}
			fetch_data(true, "POST", "http://127.0.0.1:5000/apiv1/test/uploadAnswers?user=" + username, check_answers, "answers=" + user_pack);
		}
	}

	function check_answers(res) {
		if (res['code'] == 0) {
			var display = "<p class=\"score_display\">\u4F60\u7684\u5206\u6570: " + res['score'] + "</p>";
			display += "<button class=\"op_btn result_btn\" data-action=\"display\">\u67E5\u770B\u6210\u7EE9\u5355</button>";
			display += "<button class=\"op_btn result_btn\" data-action=\"retest\">\u91CD\u65B0\u6D4B\u8BD5</button>";
			question_section.innerHTML = display;
			test_control_area.style['display'] = "none";
			bind_test_action();
		} else {
			alert("后台分数获取失败!");
			question_section.innerHTML = "";
		}
	}

	/**
  * 绑定测试做完之后的按钮点击事件
  * @return {[type]} [description]
  */
	function bind_test_action() {
		for (var _i35 = 1; _i35 < question_section.childElementCount; _i35++) {
			question_section.children[_i35].addEventListener("click", function (e) {
				e.preventDefault();
				var t = e.target || e.srcElement;
				var action = t.dataset['action'];
				if (action == "retest") {
					if (confirm("确定重新测试? 将取最高成绩作为最终结果.")) nav_btns[3].click();
				}
				if (action == "display") {
					toggle_result(true);
				}
			});
		}
	}

	function toggle_result(toggle, _user) {
		var user = _user || username;
		if (toggle) {
			result.style['transform'] = "scale3d(1,1,1)";
			fetch_data(true, "GET", "http://127.0.0.1:5000/apiv1/user/fetchInfo?username=" + escape(user), render_result);
		} else {
			result.style['transform'] = "scale3d(0,0,0)";
			clear_result();
		}
	}

	function render_result(res) {
		mask.style['display'] = "block";
		// 绘制背景
		result_context.save();
		result_context.fillStyle = "white";
		result_context.fillRect(0, 0, result_canvas.width, result_canvas.height);
		result_context.fill();
		result_context.restore();
		// 绘制标题
		result_context.save();
		result_context.font = " bold 50px Arial";
		result_context.fillStyle = "black";
		result_context.fillText("中南民族大学大型仪器虚拟仿真平台测评报告", result_canvas.width * 0.05, canvas.height * 0.2);
		result_context.fill();
		result_context.restore();
		// 填充信息
		result_context.save();
		result_context.fillStyle = "black";
		result_context.font = "30px Arial";
		result_context.fillText("\u59D3\u540D: " + res['truename'], result_canvas.width * 0.05, canvas.height * 0.45);
		result_context.fillText("\u6D4B\u8BC4\u4EEA\u5668: \u6BDB\u7EC6\u7BA1\u7535\u6CF3\u4EEA", result_canvas.width * 0.05, canvas.height * 0.6);
		result_context.fillText("\u62A5\u544A\u65F6\u95F4: " + new Date().toLocaleString(), result_canvas.width * 0.05, canvas.height * 0.75);
		result_context.fillText("\u89C6\u9891\u89C2\u770B: " + res['userstate'][0] + "\u4E2A", result_canvas.width * 0.05, canvas.height * 1.05);
		result_context.fillText("\u8BF4\u660E\u9605\u8BFB: " + Math.ceil(res['userstate'][1] / 60) + "\u5206\u949F", result_canvas.width * 0.05, canvas.height * 1.2);
		result_context.fillText("\u6D4B\u8BC4\u6210\u7EE9: " + res['userstate'][2] + " / " + res['requirement'][2], result_canvas.width * 0.05, canvas.height * 1.35);
		result_context.font = "45px Arial";
		result_context.fillText("\u6D4B\u8BC4\u7ED3\u679C: " + (res['userstate'][2] >= res['requirement'][2] - 10 ? "通过" : "未通过"), result_canvas.width * 0.05, canvas.height * 1.7);
		result_context.font = "20px Arial";
		result_context.fillText("* 本测评报告做结果参考, 以后台管理数据为准.", result_canvas.width * 0.05, canvas.height * 2.4);
		result_context.fillText("* 右键可以保存本测评报告为图片.", result_canvas.width * 0.05, canvas.height * 2.5);
		result_context.fill();
		result_context.restore();
	}

	function clear_result() {
		mask.style['display'] = "none";
		result_context.clearRect(0, 0, result_canvas.width, result_canvas.height);
	}

	function changereminder(e) {
		var t = e.target || e.srcElement;
		var reminder_in = t.parentElement.parentElement.children[2];
		var macid = t.parentElement.parentElement.children[1].innerHTML;
		if (t.innerHTML == "确定") {
			var new_reminder = reminder_in.children[0].value;
			fetch_data(true, "POST", "http://127.0.0.1:5000/apiv1/admin/setReminder?machineID=" + macid, check_admin_state, "state=" + admin_state + "&token=" + localStorage.getItem("token") + "&reminder=" + new_reminder);
		}
		if (t.innerHTML == "修改") {
			var origin_reminder = reminder_in.innerHTML;
			reminder_in.innerHTML = "<input id=\"reminder_in\" name=\"reminder\" type=\"text\">";
			t.parentElement.parentElement.children[2].children[0].value = origin_reminder;
			t.innerHTML = "确定";
		}
	}

	/**
  * 清空作答
  * @return {[type]} [description]
  */
	function clear_all() {
		var radios = document.getElementsByClassName("answer_radio");
		for (var _i36 = 0; _i36 < radios.length; _i36++) {
			var radio = radios[_i36];
			radio.checked = false;
		}
	}
})();
