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
	var btn2func = new Map()
	btn2func.set("fetch_info", fetch_info)
	btn2func.set("fetch_video", fetch_video)
	btn2func.set("fetch_instruction", fetch_instruction)
	btn2func.set("fetch_questions", fetch_questions) // data-func和目标回调函数引用的关联映射

	var admin_area = document.getElementById("admin_area");
	var close_btn = document.getElementById("icon-close");
	var aside_nav = document.getElementsByClassName("aside_select");
	var aside_list = document.getElementsByClassName("aside_list");
	var action_btns = document.getElementsByClassName("action_btn");
	var control_btns = document.getElementById("admin_control").children;
	var admin_inputbox = document.getElementById("admin_inputbox");
	var admin_input = document.getElementById("input_area");

	var video = document.getElementById("video_play");
	var video_list = document.getElementById("video_list")
	var video_control = document.getElementById("video_control");
	var tokens = null;
	var max_view = 0;
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
	var maskmask = document.getElementById("mask_for_mask");
	var logout_btn = document.getElementById("logout_btn");
	var tooltip = document.getElementById("user_tooltip");

	var canvas = document.getElementById("loading_token");
	var context = canvas.getContext('2d');
	var loading_timer = 0;
	var start_angle = 0;

	var access = 0;
	var username = "";

	var admin_state = ""

	// 具体的管理功能事件绑定
	for ( action_btn of action_btns ) {
		action_btn.addEventListener("click", e => {
			e.preventDefault()
			if (e.target.getAttribute("class").match("action_disable")) {
				alert("功能不可用!")
				return;
			}
			let action = e.target.dataset['action']
			if ( action == "setpass" ) {
				toggle_admin_inputbox(true)
				return;
			}
			do_action(action)
		})
	}

	// 对设置及格线的那个窗口按钮的事件绑定
	for ( let btn of control_btns ) {
		btn.addEventListener("click", e => {
			e.preventDefault()
			let action = e.target.dataset['action']
			if ( action == "cancel" )
				toggle_admin_inputbox(false)
			else {
				// 执行操作
				let data = new Map()
				data.set("token", localStorage.getItem("token"))
				data.set("username", username)
				data.set("state", admin_state)
				data.set("passline", admin_input.children.pass.value)
				data = make_data(data)
				if (confirm("确定设置成" + admin_input.children.pass.value + "?"))
					fetch_data("POST", "http://127.0.0.1:5000/apiv1/admin/setpass", check_setpass_state, data)
			}
		})
	}

	// 关闭管理面板的事件绑定
	close_btn.addEventListener("click", e => {
		e.preventDefault()
		e.cancelBubble = true;
		deactive_admin()
	})

	// 管理功能切换事件绑定
	for ( nav_btn of aside_nav ) {
		nav_btn.addEventListener("click", e => {
			e.preventDefault()
			let target = e.srcElement || e.target
			if ( target.tagName == "SPAN" ) {
				target = target.parentElement;
			}
			for ( let ele of aside_list ) {
				ele.setAttribute("class", "aside_list")
				if ( ele == target.parentElement)
					ele.setAttribute("class", "aside_list aside_selected")
			}
			let api_path = target.getAttribute("href")
			admin_state = api_path.split("/")[2]
			render_admin(api_path)
		})
	}

	// 导航栏的按钮切换view的事件绑定
	for ( let btn of nav_btns ) {
		btn.addEventListener("click", e => {
			e.preventDefault()
			menu_switch(e, btn, btn2view.get(btn.getAttribute("data-role")), btn2func.get(btn.getAttribute("data-callback")))
		})
	}

	// 和上面导航栏切换一样的绑定, 只不过是建立了点击映射
	for ( let btn of op_btns ) {
		// 这里直接将操作区的按钮和上面的导航按钮建立联系
		let index = btn.getAttribute("data-map");
		if (index !== "0") {
			btn.addEventListener("click", e => {
				e.preventDefault()
				nav_btns[index].click()
			})
		}
		else {
			btn.addEventListener("click", e => {
				e.preventDefault()
				e.cancelBubble = true
				active_admin()
			})
		}
	}

	// 登录和注册的面板切换的事件绑定
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

	// 用户头像点击的事件绑定, 根据是否授权分成呼出登录面板和个人信息两种
	user_mask.addEventListener("click", e => {
		e.cancelBubble = true;
		e.preventDefault()
		if (!access) toggle_login(1)
		else toggle_tooltip(1) // 登录之后改为呼出用户信息
	})

	// 登录和注册的提交事件绑定
	submit_login.addEventListener("click", e => {
		// 做提交操作
		do_login_or_register()
	})

	// 注册登出按钮的点击事件
	logout_btn.addEventListener("click", e => { logout() })

	// 防止过度后移, 记录当前观看的最大位置
	video.ontimeupdate = function () {
		if (max_viewtime < video.currentTime) {
			max_viewtime = video.currentTime;
		}
		else return
	}

	// 视频列表的点击事件绑定
	video_list.addEventListener("click", e => {
		target = e.target || e.srcElement
		if ( target.hasAttribute("link") ) {
			// 检查是否跳跃观看了
			if (checkplaying(e.target)) {
				max_viewtime = 0
				video.children[0].setAttribute("src", e.target.getAttribute("link"))
				video.load()
				for ( node of video_list.children[0].children) {
					node.removeAttribute("class")
				}
				target.setAttribute("class", "playing")
			}
			else
				alert("请按照顺序观看")
		}
	})

	// 播放完成之后的回调
	video.onended = function () {
		max_viewtime = 0
		if (document.getElementsByClassName("playing")[0].children[0].innerHTML == "○")
			max_view += 1
		// 告诉服务端, 用户看完了
		fetch_data("POST", "http://127.0.0.1:5000/apiv1/user/updateVideoIndex", checkfinished, `username=${username}&video_pass=${max_view}`)
		// 自动获取下一个的视频
		video_list.children[0].children[max_view-1].children[0].innerHTML = "√"
		video_list.children[0].children[max_view].click()
		video.play()
		video_control.children[1].innerHTML = "暂停"
	}

	// 前进, 暂停播放, 后移的事件绑定
	video_control.addEventListener('click', e => {
		e.preventDefault()
		target = e.target || e.srcElement
		if (target.dataset['role'] == "-10") {
			video.currentTime -= 10;
		}
		else if (target.dataset['role'] == "+10") {
			if (video.currentTime + 1 < max_viewtime) {
				video.currentTime += 10
			}
			else video.currentTime = max_viewtime
		}
		else if (target.dataset['role'] == "play") {
			toggle_play(target)
		}
	})

	// pdf点击事件绑定
	pdfs.addEventListener("click", e => {
		e.preventDefault()
		pdf = e.target || e.srcElement
		if (pdf.getAttribute("class") == "pdf") {
			for (each of pdfs.children) {
				each.setAttribute("class", "pdf");
			}
			pdf.setAttribute("class", "pdf selected_pdf");
			selected_pdf = pdf.getAttribute("link");
		}
		else {
			for (each of pdfs.children) {
				each.setAttribute("class", "pdf");
			}
			selected_pdf = null;
		}
	})

	// 开始阅读的事件绑定
	read_trigger.addEventListener("click", e => {
		if (selected_pdf) {
			window.open("http://127.0.0.1:5000/" + selected_pdf)
			data = `username=${username}&ins=${selected_pdf}`
			fetch_data("POST", "http://127.0.0.1:5000/apiv1/user/updateInstructionIndex", check_ins_update, data)
		}
		else {
			alert("你还没有选择阅读材料.");
		}
	})

	/**
	 * 检查阅读材料的阅读回调
	 * @param  {[type]} res [description]
	 * @return {[type]}     [description]
	 */
	function check_ins_update(res) {
		if (res['finished']) {
			alert("你已经完成说明阅读要求")
		}
	}

	/**
	 * 1. 向远端验证用户身份, 并且获取一个token用来在以后的API调用时进行AUTH
	 * 2. 激活管理页面
	 * @return {[type]} [description]
	 */
	function active_admin() {
		if (access) {
			fetch_data("POST", "http://127.0.0.1:5000/apiv1/admin/getToken", _active_admin, "username=" + username)
			admin_area.style['transform'] = "scale3d(1, 1, 1)"
		}
		else alert("你还没有登录!")
	}

	/**
	 * 召唤出管理页面, 默认用用户管理做首页
	 * @param  {[type]} res [description]
	 * @return {[type]}     [description]
	 */
	function _active_admin(res) {
		if (!res['access']) {
			alert("你没有权限访问.")
			deactive_admin()
			return;
		}
		token = res['token']
		localStorage.setItem("token", token)
		// 模拟点击用户管理
		aside_nav[0].click()
	}

	/**
	 * 删除token并且把admin页面隐藏
	 * @return {[type]} [description]
	 */
	function deactive_admin() {
		localStorage.removeItem("token")
		admin_state = ""
		admin_area.style['transform'] = "scale3d(1, 0, 1)"
	}

	/**
	 * 主页的机器信息和介绍抓取
	 * @return {[type]} [description]
	 */
	function fetch_info() {
		// fetch_data("GET", "http://127.0.0.1:5000/apiv1/")
		// 暂时不考虑
	}

	/**
	 * 视频列表抓取和对应的地址
	 * @return {[type]} [description]
	 */
	function fetch_video() {
		fetch_data("GET", "http://127.0.0.1:5000/apiv1/video/getVideoIndex", _fetch_video)
	}

	/**
	 * 渲染视频列表, 并进一步的抓取用户当前已经看到的, 并修改列表
	 * @param  {[type]} res [description]
	 * @return {[type]}     [description]
	 */
	function _fetch_video(res) {
		videos = res['data']
		html = "<ul>"
		for (let video of videos) {
			html += `<li class="" link=http://127.0.0.1:5000/${video[1]}><span class="seen_token">○</span>${video[0]}</li>`
		}
		html += "</ul>"
		video_list.innerHTML = html
		fetch_data("GET", "http://127.0.0.1:5000/apiv1/user/fetchInfo?username=" + escape(username), highlight_videolist)
	}

	/**
	 * _fetch_video中的回调函数, 修改列表完成情况并且自动将当前该观看的视频模拟点击
	 * @param  {[type]} res [description]
	 * @return {[type]}     [description]
	 */
	function highlight_videolist(res) {
		haveseen = res.userstate[0]
		max_view = haveseen
		tokens = document.getElementsByClassName("seen_token")
		for (let i = 0; i < haveseen; i ++) {
			tokens[i].innerHTML = "√"
		}
		tokens[haveseen].parentElement.click()
	}

	/**
	 * 观看完成视频的回调, 检测用户是否已经完成观看任务
	 * @param  {[type]} res [description]
	 * @return {[type]}     [description]
	 */
	function checkfinished(res) {
		if (res['code'] == '0') {
			for (let i = 0; i < max_view; i ++) {
				tokens[i].innerHTML = "√"
			}
			if ( res['finished'] )
				alert("你已经完成视频观看要求!")
		}
		else {
			max_view --;
			alert("远端数据库更新失败!")
		}
	}

	/**
	 * 确保用户只可以按照顺序进行观看, 这个处理逻辑是和统计功能挂钩的
	 * @param  {[type]} target [description]
	 * @return {[type]}        [description]
	 */
	function checkplaying(target) {
		iter_nodes = video_list.children[0].children;
		for ( let i = 0; i < iter_nodes.length; i++ ) {
			if ( target == iter_nodes[i] ) {
				if ( i == 0 ) return true
				if ( iter_nodes[i-1].children[0].innerHTML == "√" ) {
					return true
				}
				else return false
			}
		}
	}

	/**
	 * 说明材料列表抓取和对应的地址
	 * @return {[type]} [description]
	 */
	function fetch_instruction() {
		fetch_data("GET", "http://127.0.0.1:5000/apiv1/instruction/getInstructionIndex", _fetch_instruction)
	}

	/**
	 * 渲染PDF
	 * @param  {[type]} res [description]
	 * @return {[type]}     [description]
	 */
	function _fetch_instruction(res) {
		html = ""
		for ( let i = 0; i < res['data'].length; i ++ ) {
			html += `<div class="pdf" link="${res['data'][i][1]}">
						<p>${res['data'][i][0].split(".")[0]}</p>
					</div>`
		}
		pdfs.innerHTML = html
	}

	/**
	 * 测评题目获取
	 * @return {[type]} [description]
	 */
	function fetch_questions() {

	}

	/**
	 * 视频播放和暂停的切换函数
	 * @param  {[type]} button [description]
	 * @return {[type]}        [description]
	 */
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

	/**
	 * 用于注册和登录输入框的切换, 事实上他们共用输入框
	 * @param  {[type]} role [description]
	 * @return {[type]}      [description]
	 */
	function panel_switch(role) {
		clear_login()
		submit_login.setAttribute("data-action", role)
		for ( let part of login_part ) {
			part.style["display"] = role == "login" ? "none" : "block"
		}

	}

	/**
	 * 按钮样式切换
	 * @param  {[type]} selected_btn [description]
	 * @return {[type]}              [description]
	 */
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
	* @param  {[type]}   error_callback 出现错误的时候调用的函数
	*/
	function fetch_data(method, url, callback, data, error_callback) {
		toggle_loading(1)
		var xhr = new XMLHttpRequest();
		xhr.open(method, url);
		xhr.timeout = 9000;
		if (method === "POST") {
			xhr.setRequestHeader("Content-Type", 'application/x-www-form-urlencoded');
		}
		xhr.send(unescape(data));
		xhr.ontimeout = function (e) {
			toggle_loading(0)
			alert("错误(000T)! 请求超时,请检查网络连接.");
			if (error_callback) error_callback(xhr);
		};
		xhr.onerror = function (e) {
			toggle_loading(0)
			alert("出现错误(000U)! 技术人员请参考控制台输出.")
			console.log(xhr.status + "<->" + xhr.statusText);
			if (error_callback) {
				error_callback(xhr);
			}
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

	/**
	 * 执行登录或者注册操作, 由当前显示的输入信息决定执行哪一个操作
	 * 都会先进行各自的填充本地验证, 接着组装信息 将他们发送.
	 * 增加了敏感字符和SQL关键字的过滤
	 * @param  {[type]} abs_login [description]
	 * @return {[type]}           [description]
	 */
	function do_login_or_register(abs_login) {
		let role = abs_login || submit_login.dataset['action'] || document.getElementsByClassName("current_action")[0].dataset['role']
		let form = new Map()
		if (role == 'register') {
			// 填充验证
			for ( let i = 1; i < login_panel.childElementCount - 1; i++) {
				if (login_panel.children[i].value == "") {
					alert(login_panel.children[i].placeholder+"不能为空");
					return;
				}
				if ( validate(login_panel.children[i].value) && filterSqlStr(login_panel.children[i].value) ) {
					form.set(login_panel.children[i].name, login_panel.children[i].value)
				}
				else  {
					login_panel.children[i].value = ""
					return;
				}
			}
			// 密码验证
			if ( login_part[2].value != login[1].value ) {
				alert("两次输入的密码不一致");
				login_part[2].value = "";
				login[1].value = "";
				return;
			}
			form.delete("passwd_validate");
			if (admin_state == "users") {
				form.set("token", localStorage.getItem("token"))
				form.set("state", admin_state)
			}
			// 注册信息组装
			data = make_data(form)
			// 发送注册请求
			fetch_data("POST", "http://127.0.0.1:5000/apiv1/user/doSignin", check_register_state, data, toggle_login)
		}
		else {
			// 填充验证
			for ( let ele of login ) {
				if (ele.value == "") {
					alert(ele.placeholder+"不能为空");
					return;
				}
				if ( validate(ele.value) && filterSqlStr(ele.value) ) {
					form.set(ele.name, ele.value)
				}
				else {
					ele.value = ""
					return;
				}
			}
			// 登录信息组装
			data = make_data(form)
			// 发送登录请求
			fetch_data("POST", "http://127.0.0.1:5000/apiv1/user/doLogin", check_login_state, data, toggle_login)
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
			toggle_login(0)
			//TODO: admin特例处理
			if ( res['api'] ) {
				render_admin(res['api'])
				return;
			}
			// 如果不是在管理界面, 就直接登陆了
			do_login_or_register("login")
		}
		if (res['code'] == '-1') {
			// 后台数据库写入失败
			alert("注册失败! 后台数据写入异常! 请重试.")
			mask.style['display'] = "block"
		}
		if (res['code'] == '-4') {
			alert("注册失败! 用户名已经被注册了!")
			mask.style['display'] = "block"
			login[0].value = ""
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
			username = res['username']
			greeting.innerHTML = "欢迎," + res['username']
			access = 1
			toggle_login(0)
		}
		if (res['code'] == '1') {
			// 密码错误
			alert("登录失败! 密码错误!")
			mask.style['display'] = "block"
		}
		if (res['code'] == '2') {
			// 用户不存在
			alert("登录失败! 用户不存在!")
			mask.style['display'] = "block"
		}
		if (res['code'] == '3') {
			// 用户账户被冻结
			alert("登录失败! 用户账户被冻结, 请联系管理员激活!")
			mask.style['display'] = "block"
		}
	}

	/**
	 * 验证登出状态函数
	 * @param  {[type]} res [description]
	 * @return {[type]}     [description]
	 */
	function check_logout_state(res) {
		if (res['code'] == "0") {
			greeting.innerHTML = "请先登录!"
			alert("登出成功!")
			access = 0;
			max_view = 0;
			max_viewtime = 0;
			selected_pdf = null;
		}
		else {
			alert("登出失败! 请稍后尝试.")
			max_view = 0;
			max_viewtime = 0;
		}
	}

	/**
	 * 登出操作
	 * @return {[type]} [description]
	 */
	function logout() {
		if (confirm("确定登出?")) {
			data = "username=" + username
			fetch_data("POST", "http://127.0.0.1:5000/apiv1/user/doLogout", check_logout_state, data)
			toggle_tooltip(0)
			nav_btns[0].click()
		}
		return;
	}

	/**
	 * Map转换函数, 返回字符串
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
				alert("包含非法字符!")
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
		mask.style['display'] = toggle == "1" ? "block" : "none";
		if (toggle == "1") {
			maskmask.style['display'] = "block"
			canvas.style['transform'] = "scale3d(1, 1, 1)";
			loading_timer = requestAnimationFrame(render_loading)
		}
		else {
			maskmask.style['display'] = "none"
			cancelAnimationFrame(loading_timer)
			canvas.style['transform'] = "scale3d(0, 0, 0)"
		}
	}

	/**
	 * toggle加载登录注册面板和覆盖层
	 * @param  {[type]} toggle [description]
	 * @return {[type]}        [description]
	 */
	function toggle_login(toggle, register_only) {
		mask.style['display'] = toggle == "1" ? "block" : "none";
		for ( switcher of action_switch.children ) {
			switcher.style.display = "block"
		}
		if (toggle == "1") {
			login_panel.style['transform'] = "translate3d(0, 0, 0)"
			mask.addEventListener("click", toggle_login)
		}
		else {
			login_panel.style['transform'] = "translate3d(0, -250%, 0)"
			mask.removeEventListener("click", toggle_login)
		}
		if (register_only) {
			action_switch.children[0].click() // 点击注册按钮切换
			for ( switcher of action_switch.children ) {
				switcher.style.display = "none"
			}
		}
		clear_login()
	}

	/**
	 * 清空输入框
	 * @return {[type]} [description]
	 */
	function clear_login() {
		for ( let i = 1; i < login_panel.childElementCount - 1; i++) {
			login_panel.children[i].value = ""
		}
	}

	/**
	 * toggle用户个人信息的函数
	 * @param  {[type]} toggle [description]
	 * @return {[type]}        [description]
	 */
	function toggle_tooltip(toggle) {
		if (toggle == "1") {
			fetch_data("GET", "http://127.0.0.1:5000/apiv1/user/fetchInfo?username="+escape(username), fill_user_info, null, toggle_tooltip)
			tooltip.style['transform'] = "translate3d(0, 0, 0)"
			// 由于这里需要调用toggle_loading 会导致mask消失
			// 所以需要在后面调用
			mask.addEventListener("click", toggle_tooltip)
		}
		else {
			tooltip.style['transform'] = "translate3d(0, -200%, 0)"
			mask.removeEventListener("click", toggle_tooltip)
			mask.style['display'] = "none"
		}
	}

	var items = document.getElementsByClassName("tip_value")
	/**
	 * 用户登录之后填充tooltip信息
	 * @param  {[type]} res [description]
	 * @return {[type]}     [description]
	 */
	function fill_user_info(res) {
		mask.style['display'] = "block"
		tooltip.children[0].innerHTML = "你好," + res['truename']
		for (let i = 0; i < items.length; i ++) {
			items[i].innerHTML = res.userstate[i] + "/" + res.requirement[i]
		}
		if (res.userstate[3] == "0") {
			items[2].innerHTML = '还未参加测评'
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

	/**
	 * 统一处理管理页面的渲染的入口函数
	 * @param  {[type]} api [description]
	 * @return {[type]}     [description]
	 */
	function render_admin(api) {
		fetch_data("POST", "http://127.0.0.1:5000/apiv1" + api, _render_admin, "token=" + localStorage.getItem("token"))
	}

	/**
	 * 检查及格线设置是否成功
	 * @param  {[type]} res [description]
	 * @return {[type]}     [description]
	 */
	function check_setpass_state(res) {
		if (res['code'] == 0) {
			alert("修改成功!")
			toggle_admin_inputbox(false)
		}
		else
			alert("修改失败!")
	}

	/**
	 * toggle及格线输入窗口
	 * @param  {[type]} toggle [description]
	 * @return {[type]}        [description]
	 */
	function toggle_admin_inputbox(toggle) {
		admin_input.children.pass.value = ""
		if ( toggle )
			admin_inputbox.style['transform'] = "scale3d(1,1,1)"
		else
			admin_inputbox.style['transform'] = "scale3d(0,0,0)"
	}


	function access_test(res) {
		if (!res['access']) {
			if ( res['code'] == -1 )
				alert("密钥过期! 请重新进入管理页面!")
			if ( res['code'] == -2 )
				alert("密钥错误! 请尝试重新登录!")
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
		desc_area_head.children[1].innerHTML = ""
		desc_area_body.children[1].innerHTML = ""
		if (!access_test(res)) return;
		action = res['attr']
		if (action == "users") {
			rule = [3, 5, 13, 10, 25, 10, 10, 24]
		}
		if (action == "videos") {
			rule = [3, 10, 20, 10]
		}
		if (action == "instructions") {
			rule = [3, 10, 20, 10]
		}
		if (action == "tests") {
			rule = [3, 35, 35, 17]
		}
		// 填充位置约束的colgroup
		rule_ele = ""
		for ( let i = 0; i < rule.length; i ++ ) {
			rule_ele += `<col style="width: ${rule[i]}%">`
		}
		desc_area_head.children[0].innerHTML = rule_ele
		desc_area_body.children[0].innerHTML = rule_ele
		// 填充title
		title_ele = `<tr><th><input type="checkbox" data-action="all" class="admin_checkbox admin_checkbox_all"></th>`
		for ( let j = 0; j < res['title'].length; j ++ ) {
			title_ele += `<th>${res['title'][j]}</th>`
		}
		title_ele += "</tr>"
		desc_area_head.children[1].innerHTML = title_ele
		// 填充具体的表格
		if (action == "users") {
			main_ele = ""
			for ( user of res['data'] ) {
				main_ele += `<tr class="item_row" data-key="${user['info'][1]}"><td><input type="checkbox" data-name="" class="admin_checkbox"></td>`
				// 先填充前面的用户信息
				for ( let m = 0; m < user['info'].length; m ++ ) {
					value = user['info'][m]
					if ( m == 4 || m == 5 ) {
						value = user['info'][m] == 1 ? "是" : "否"
					}
					main_ele += `<td>${value}</td>`
				}
				// 再填充后面的用户状态
				main_ele += `<td><div><p>视频观看: ${user['state'][0]}/${res['require'][0]}</p><p>说明阅读: ${user['state'][1]}/${res['require'][1]}</p>`
				if ( user['state'][3] == 0 ) 
					main_ele += "<p>尚未参加测评</p></div>"
				else
					main_ele += `<p>${user['state'][2]}/${res['require'][2]}<p></div>`
				main_ele += `</tr>`
			}
			desc_area_body.children[1].innerHTML = main_ele
			// disable最后一个按钮
			for ( let btn = 0; btn < action_btns.length; btn ++ ) {
				action_btns[btn].setAttribute("class", "action_btn")
			}
			action_btns[6].setAttribute("class", "action_btn action_disable")
			bind_checkbox()
			return;
		}
		main_ele = ""
		for ( let item = 0; item < res['data'].length; item ++ ) {
			main_ele += `<tr class="item_row" data-key="${res['data'][item][0]}"><td><input type="checkbox" data-action="" class="admin_checkbox"></td>`
			main_ele += `<td>${item+1}</td>`
			for ( let n = 0; n < res['data'][item].length; n ++ ) {
				main_ele += `<td>${res['data'][item][n]}</td>`
			}
			main_ele += "</tr>"
		}
		desc_area_body.children[1].innerHTML = main_ele
		// 调整上方操作按钮
		for ( let btn = 0; btn < action_btns.length; btn ++ ) {
			action_btns[btn].setAttribute("class", "action_btn")
			if ( btn >= 2 && btn <= 5 )
				action_btns[btn].setAttribute("class", "action_btn action_disable")
		}
		bind_checkbox()
		return;
	}

	/**
	 * 绑定勾选框的事件绑定, 是动态绑定的
	 * @return {[type]} [description]
	 */
	function bind_checkbox() {
		box = document.getElementsByClassName("admin_checkbox_all")[0]
		boxes = document.getElementsByClassName("admin_checkbox")
		for ( let b = 1; b < boxes.length; b ++ ) {
			boxes[b].addEventListener("click", e => {
				for ( let b = 1; b < boxes.length; b ++ ) {
					if ( !boxes[b].checked ) {
						box.checked = false
						return;
					}
				}
				box.click()
			})
		}
		box.addEventListener("click", e => {
			for ( let b = 1; b < boxes.length; b ++ )
				boxes[b].checked = box.checked
		})
	}

	/**
	 * 尝试抓取所有的checkbox元素所在的那一行的data-key
	 * @return {[type]} [description]
	 */
	function check_target() {
		result = [];
		let boxes = document.getElementsByClassName("admin_checkbox")
		if ( boxes[0].checked ) {
			eles = document.getElementsByClassName("item_row")
			for ( let ele of eles ) {
				result.push(ele.dataset['key'])
			}
		}
		else {
			for ( let i = 1; i < boxes.length; i ++ ) {
				if ( boxes[i].checked ) {
					result.push(boxes[i].parentElement.parentElement.dataset['key'])
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
		if ( toggle ) {

		}
		else {

		}
	}

	/**
	 * 管理通用, 检查删除操作状态的回调函数
	 * @param  {[type]} res [description]
	 * @return {[type]}     [description]
	 */
	function check_del_state(res) {
		if (!access_test(res)) return;
		if ( res['code'] == 0 ) {
			alert("删除操作执行成功!\n如有需要, 请调整及格线!")
			render_admin(res['api'])
		}
		else {
			alert("删除操作执行失败!")
		}
	}

	/**
	 * 执行action代理函数, 由此来召唤不同的函数
	 * @param  {[type]} action [description]
	 * @return {[type]}        [description]
	 */
	function do_action(action) {
		target = check_target()
		// 我们这里进行分开处理, 由于用户的操作比较多, 并且全部都涉及数据库操作, 因此单独拿出来
		if ( admin_state == "users" ) {
			do_user_action(target, action)
		} // 而对于其他的state,比较统一,都是新增(文件上传)和删除(后台删除文件)的操作, 所以放在一起
		else {
			if ( action == "new" ) {
				toggle_upload(true)
			}
			if ( action == "del" ) {
				if (target.length == 0) {
					alert("你还没有选择任何项目!")
					return;
				}
				if ( confirm("确定删除下面的项目吗?\n" + target) ) {
					let data = new Map()
					data.set("token", localStorage.getItem("token"))
					data.set("username", username)
					data.set("state", admin_state)
					data.set("target", target)
					data = make_data(data)
					fetch_data("POST", "http://127.0.0.1:5000/apiv1/admin/del", check_del_state, data)
				}
				else
					return;
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
		if ( action == "new" ) {
			toggle_login(1, true)
			return;
		}
		let data = new Map()
		target = check_target()
		if (target.length == 0) {
			alert("你还没有选择任何用户")
			return;
		}
		data.set("token", localStorage.getItem("token"))
		data.set("targets", target)
		data.set("user", username)
		data.set("state", admin_state)
		data = make_data(data)
		// 删除用户
		if ( action == "del" ) {
			if (confirm("确定删除下面的用户?\n⚠️警告!删除后将不可恢复!\n\n" + target)) {
				fetch_data("POST", "http://127.0.0.1:5000/apiv1/user/delUser", check_del_state, data)
			}
			return;
		}
		// 冻结用户
		if ( action == "deactive" ) {
			if (confirm("是否冻结下面的用户?\n警告⚠️!同时会收回用户的管理员权限!\n\n" + target)) {
				fetch_data("POST", "http://127.0.0.1:5000/apiv1/user/deactiveUser", check_admin_state, data)
			}
			return;
		}
		// 激活用户
		if ( action == "active" ) {
			if (confirm("确定激活下面的用户?\n\n" + target)) {
				fetch_data("POST", "http://127.0.0.1:5000/apiv1/user/activeUser", check_admin_state, data)
			}
			return;
		}
		// 授权用户成为管理员
		if ( action == "grant" ) {
			if (confirm("确定授权下面的用户?\n警告⚠️!管理员权限很大!\n\n" + target)) {
				fetch_data("POST", "http://127.0.0.1:5000/apiv1/user/grantUser", check_admin_state, data)
			}
			return;
		}
		// 取消用户授权
		if ( action == "ungrant" ) {
			if (confirm("确定对下面的用户收回授权?\n\n" + target)) {
				fetch_data("POST", "http://127.0.0.1:5000/apiv1/user/ungrantUser", check_admin_state, data)
			}
		}
	}

	/**
	 * 处理管理功能操作的统一处理结果回调函数
	 * @param  {[type]} res [description]
	 * @return {[type]}     [description]
	 */
	function check_admin_state(res) {
		if (!access_test(res)) return;
		render_admin(res['api'])
		if ( res['code'] == 0 )
			alert("操作成功!")
		else
			alert("操作失败!请稍后重试!")
	}



})()