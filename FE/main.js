(function () {
	var nav_btns = document.getElementsByClassName("nav_btn");
	var main_area = document.getElementById("main");
	var video_area = document.getElementById("video_area");
	var instruction_area = document.getElementById("instruction_area");
	var test_area = document.getElementById("test_area");
	var op_btns = document.getElementById('control_center').children
	var curView = document.getElementsByClassName("current")[0];
	var btn2view = new Map()
	btn2view.set("index", main_area)
	btn2view.set("video", video_area)
	btn2view.set("instruction", instruction_area)
	btn2view.set("test", test_area) // data-role和目标视图的关联映射

	var video = document.getElementById("video_play");
	var video_control = document.getElementById("video_control");
	var max_viewtime = 0;

	var read_trigger = document.getElementById('readpdf_btn');
	var pdfs = document.getElementById("pdf_preview")
	var selected_pdf = null;

	var user_mask = document.getElementById("user_mask")
	var login_panel = document.getElementById("login_panel");
	var action_switch = document.getElementById("action_switch");
	var login_part = document.getElementsByClassName("login_part")
	var login = document.getElementsByClassName("login");
	var greeting = document.getElementById("greeting");
	var submit_login = document.getElementById("submit_login");
	var mask = document.getElementById("mask");
	var canvas = document.getElementById("loading_token");
	var context = canvas.getContext('2d');
	var loading_timer = 0;
	var start_angle = 0;
	var access = 0;
	var username = "";

	window.onload = e => {
		fetch_data("GET", "http://127.0.0.1:5000/apiv1/user/checkLogin", check_state, null)
	}

	function check_state(res) {
		console.log(res)

	}

	// TODO: 如果不支持let关键字时间绑定就会全部失效
	// 注: 正常情况下, Win10应该没问题, 怕的是Win7啊
	// 其实这里一种更好的解决方法是直接捕获整个nav区域的点击事件, 根据
	// target来进行判断, 但我同样担心兼容性(IE8)
	for ( let btn of nav_btns ) {
		btn.addEventListener("click", e => {
			e.preventDefault()
			menu_switch(e, btn, btn2view.get(btn.getAttribute("data-role")))
		})
	}

	for ( let btn of op_btns ) {
		// 这里直接将操作区的按钮和上面的导航按钮建立联系
		let index = btn.getAttribute("data-map");
		if (index !== "0") {
			btn.addEventListener("click", e => {
				e.preventDefault()
				nav_btns[index].click()
			})
		}
		else btn.onclick = e => { alert("操作未定义.") }
	}

	for ( let btn of action_switch.children ) {
		let role = btn.getAttribute("data-role");
		btn.addEventListener("click", e => {
			e.preventDefault();
			panel_switch(role);
			for ( let btn of action_switch.children ) {
				btn.removeAttribute("class")
			}
			btn.setAttribute("class", "current_action")
		})
	}

	user_mask.addEventListener("click", e => {
		if (!access) toggle_login(1)
		else logout() // 登录之后改为登出
	})

	submit_login.addEventListener("click", e => {
		do_login_or_register()
	})

	video.ontimeupdate = function () {
		if (max_viewtime < video.currentTime) {
			max_viewtime = video.currentTime;
		}
		else return
	}

	video.onended = function () {
		// 播放结束, 请求下一个
		// TODO: 等待请求下一个接口完成
		video_control.children[1].innerHTML = "播放"
	}

	video_control.addEventListener('click', e => {
		e.preventDefault()
		if (e.target.dataset['role'] == "-10") {
			video.currentTime -= 10;
		}
		else if (e.target.dataset['role'] == "+10") {
			if (video.currentTime + 1 < max_viewtime) {
				video.currentTime += 10
			}
			else video.currentTime = max_viewtime
		}
		else if (e.target.dataset['role'] == "play") {
			toggle_play(e.target)
		}
	})

	pdfs.addEventListener("click", e => {
		e.preventDefault()
		pdf = e.target
		if (pdf.getAttribute("class") == "pdf") {
			for (each of pdfs.children) {
				each.setAttribute("class", "pdf");
			}
			pdf.setAttribute("class", "pdf selected_pdf");
			selected_pdf = pdf;
		}
		else {
			for (each of pdfs.children) {
				each.setAttribute("class", "pdf");
			}
			selected_pdf = null;
		}
	})

	read_trigger.addEventListener("click", e => {
		if (selected_pdf) {
			// 调用PDF.js打开一个新窗口来阅读
		}
		else {
			alert("你还没有选择阅读材料.");
		}
	})

	function toggle_play(button) {
		state = video.paused;
		if (state) {
			video.play();
			button.innerHTML = "暂停"
		}
		else {
			video.pause();
			button.innerHTML = "播放"
		}
	}

	function panel_switch(role) {
		for ( let part of login_part ) {
			part.style["display"] = role == "login" ? "none" : "block"
		}
	}

	function btn_switch(selected_btn) {
		for ( let btn of nav_btns ) {
			btn.setAttribute("class", "nav_btn");
		}
		selected_btn.setAttribute("class", "nav_btn selected")
	}

	/**
	* 向服务端请求的统一接口函数. ( 核心函数 )
	* @param  {[type]}   method   Ajax方法
	* @param  {[type]}   url      请求的接口地址
	* @param  {Function} callback 收到请求的回调函数
	* @param  {[type]}   data     POST的数据--类型:对象
	*/
	function fetch_data(method, url, callback, data) {
		var xhr = new XMLHttpRequest();
		xhr.open(method, url);
		xhr.timeout = 9000;
		if (method === "POST") {
			xhr.setRequestHeader("Content-Type", 'application/x-www-form-urlencoded');
		}
		xhr.send(data);
		toggle_loading(1)
		xhr.ontimeout = function (e) {
			toggle_loading(0)
			alert("错误(000T)! 请求超时,请检查网络连接.");
			//TODO: 作进一步处理
		};
		xhr.onerror = function (e) {
			toggle_loading(0)
			alert("出现错误(000U)! 技术人员请参考控制台输出.")
			console.log(xhr.status + "<->" + xhr.statusText);
		};
		xhr.onreadystatechange = function () {
			if (xhr.readyState == 4 && xhr.status == 200) {
				//成功fetch到数据
				toggle_loading(0)
				try {
					var res = JSON.parse(xhr.response);
				} catch (e) {
					alert("错误! 后台结果异常(000J)");
				}
				return callback(res);
			}
		};
	}

	function do_login_or_register(abs_login) {
		role = abs_login || document.getElementsByClassName("current_action")[0].getAttribute("data-role")
		form = new Map()
		if (role == 'register') {
			// 填充验证
			for ( let i = 1; i < login_panel.childElementCount - 1; i++) {
				if (login_panel.children[i].value == "") {
					alert(login_panel.children[i].placeholder+"不能为空");
					delete form
					return;
				}
				form.set(login_panel.children[i].name, login_panel.children[i].value)
			}
			// 密码验证
			if ( login_part[2].value != login[1].value ) {
				alert("两次输入的密码不一致");
				login_part[2].value = "";
				login[1].value = "";
				return;
			}
			form.delete("passwd_validate");
			// 注册信息组装
			data = make_data(form)
			// 发送注册请求
			fetch_data("POST", "http://127.0.0.1:5000/apiv1/user/doSignin", check_register_state, data)
		}
		else {
			// 填充验证
			for ( let ele of login ) {
				if (ele.value == "") {
					alert(ele.placeholder+"不能为空");
					return;
				}
				form.set(ele.name, ele.value)
			}
			// 登录信息组装
			data = make_data(form)
			// 发送登录请求
			fetch_data("POST", "http://127.0.0.1:5000/apiv1/user/doLogin", check_login_state, data)
		}
	}

	function check_register_state(res) {
		if (res['code'] == '0') {
			// 注册成功
			do_login_or_register("login")
		}
		if (res['code'] == '-1') {
			// 后台数据库写入失败
			alert("注册失败! 后台数据写入异常!")
		}
		toggle_login(0)
	}

	function check_login_state(res) {
		if (res['code'] == '0') {
			// 登陆成功
			username = res['username']
			greeting.innerHTML = "欢迎," + res['username']
			access = 1
			toggle_login(0)
		}
		if (res['code'] == '1') {
			// 密码错误
			alert("登录失败! 密码错误!")
		}
		if (res['code'] == '2') {
			// 用户不存在
			alert("登录失败! 用户不存在!")
		}
		if (res['code'] == '3') {
			// 用户账户被冻结
			alert("登录失败! 用户账户被冻结, 请联系管理员激活!")
		}
	}

	function check_logout_state(res) {
		if (res['code'] == "0") {
			greeting.innerHTML = "请先登录!"
			alert("登出成功!")
			access = 0
		}
		else {
			alert("登出失败! 请稍后尝试.")
		}
	}

	function logout() {
		data = "username=" + username
		fetch_data("POST", "http://127.0.0.1:5000/apiv1/user/doLogout", check_logout_state, data)
	}

	/**
	 * FormData转换函数, 返回字符串
	 * @param  {[type]} form [description]
	 * @return {[type]}      [description]
	 */
	function make_data(form) {
		data = ""
		for ( let entry of form.entries() ) {
			data += entry[0]
			data += "="
			data += entry[1]
			data += "&"
		}
		data = data.substr(0, data.length-1)
		return data
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
			toggle_login(1)
			return;
		}
		e.cancelBubble = true;
		btn_switch(selected_btn);
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
		mask.style['display'] = toggle ? "block" : "none";
		if (toggle) {
			canvas.style['transform'] = "scale3d(1, 1, 1)";
			loading_timer = requestAnimationFrame(render_loading)
		}
		else {
			cancelAnimationFrame(loading_timer)
			canvas.style['transform'] = "scale3d(0, 0, 0)"
		}
	}

	/**
	 * toggle加载登录注册面板和覆盖层
	 * @param  {[type]} toggle [description]
	 * @return {[type]}        [description]
	 */
	function toggle_login(toggle) {
		mask.style['display'] = toggle ? "block" : "none";
		if (toggle) {
			login_panel.style['transform'] = "translate3d(0, 0, 0)"
			mask.addEventListener("click", e => { toggle_login(0) })
		}
		else {
			login_panel.style['transform'] = "translate3d(0, -150%, 0)"
			mask.removeEventListener("click", e => { toggle_login(0) })
		}
		clear_login()
	}

	function clear_login() {
		for ( let i = 1; i < login_panel.childElementCount - 1; i++) {
			login_panel.children[i].value = ""
		}
	}

	/**
	 * 加载动画渲染函数
	 * @return {[type]} [description]
	 */
	function render_loading() {
		context.clearRect(0, 0, canvas.width, canvas.height)
		context.strokeStyle = "rgb(49, 71, 74)"
		context.lineWidth = 10
		context.beginPath()
		context.arc(canvas.width/2, canvas.height/2, canvas.width/3, start_angle, start_angle+Math.PI *1.3)
		context.stroke()
		context.lineWidth = 1
		context.font = "30px SimHei"
		context.textAlign = "center"
		context.strokeText("加载中", canvas.width/2, canvas.height/2)
		start_angle += 0.1
		start_angle %= Math.PI * 2 // 防止数值太大
		loading_timer = requestAnimationFrame(render_loading)
	}

})()