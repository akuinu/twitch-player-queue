console.clear();
var ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443/', 'irc');
var BOT_OAUTH_TOKEN, BOT_USERNAME, CHANNEL;
var app = new Vue({
    el: '#app',
    data: {
        usersQueued: [
            {
                name: 'user_0',
                value: 1,
				messageSent: false,
				time: new Date
            },
            {
                name: 'user_1',
                value: 2,
				messageSent: false,
				time: new Date
            }
        ],
		usersPlayed: [],
		message: "Type !join in chat to join.",
		whisper: "The game code is XXXX",
		connectionOpen: false,
		settings: {
			disply: true,
			channel: "",
			channelInfoShow: false,
			user: "",
			userInfoShow: false,
			OAUTH_TOKEN: "",
			OAUTH_TOKENInfoShow: false,
			keyword: "!join",
			keywordInfoShow: false,
			colours: false
		}
    },
    mounted() {
		if (localStorage.channel){
			this.settings.channel = localStorage.channel;
		}
		if (localStorage.user){
			this.settings.user = localStorage.user;
		}
		if (localStorage.OAUTH_TOKEN){
			this.settings.OAUTH_TOKEN = localStorage.OAUTH_TOKEN;
		}
		if (localStorage.keyword){
			this.settings.keyword = localStorage.keyword;
		}
		if(sessionStorage.getItem("usersQueued")) {
		  try {
			this.usersQueued = JSON.parse(sessionStorage.getItem("usersQueued"));
		  } catch(e) {
			sessionStorage.removeItem("usersQueued");
		  }
		}
		if(sessionStorage.getItem("usersPlayed")) {
		  try {
			this.usersPlayed = JSON.parse(sessionStorage.getItem("usersPlayed"));
		  } catch(e) {
			sessionStorage.removeItem("usersPlayed");
		  }
		}
	},
	watch: {
		usersQueued: function() {
			let parsed = JSON.stringify(this.usersQueued);
			sessionStorage.setItem("usersQueued", parsed);
		},
		usersPlayed: function() {
			let parsed = JSON.stringify(this.usersPlayed);
			sessionStorage.setItem("usersPlayed", parsed);
		},
		whisper: async function() {
			this.usersQueued.forEach(async (user) => { user.messageSent = false; });
		}
	},
	methods: {
		connect: function(){
			connectChat(this.settings);
			this.saveSettings();
			this.settings.disply = false;
		},
        addUser: function (userData) {
			for (var i = 0, l = this.usersPlayed.length; i < l; ++i) {
				if (this.usersPlayed[i].name === userData.username) {
					var user = this.usersPlayed.splice(i, 1)[0];
					user.time = new Date;
					this.usersQueued.push(user);
					return;
				}
			}
			for (var i = 0, l = this.usersQueued.length; i < l; ++i) {
				if (this.usersQueued[i].name === userData.username) {
					// TODO: wants to join again? just ignore?
					return;
				}
			}
            var item = {
                name: userData.username,
				value: 0,
				messageSent: false,
				color: '#000000',
				displayName: userData.username,
				time: new Date
            };
			var colorRegexMatch = userData.tags.match(/color=(#[0-9A-Fa-f]{6});/);
			if (colorRegexMatch) {
				item.color = colorRegexMatch[1];
			}
			var displayNameRegexMatch = userData.tags.match(/display-name=([^;]+);/);
			if (displayNameRegexMatch) {
				item.displayName = displayNameRegexMatch[1];
			}

            this.usersQueued.push(item);
        },
		announce: function (){
			sentMessageToChat(this.message);
		},
    announceSecret: function (){
      sentMessageToChat(this.whisper);
    },
		sendWhisper: function (index) {
			sentWhisper(this.usersQueued[index].name,this.whisper)
			this.usersQueued[index].messageSent = true;
		},
        removeItem: function (index) {
            this.usersQueued.splice(index, 1);
        },
		joinedGame: function (index) {
			this.usersQueued[index].value++;
			this.usersQueued[index].messageSent = false;
			this.usersPlayed.push(this.usersQueued.splice(index, 1)[0]);
		},
		clear: function() {
			this.usersQueued = [];
			this.usersPlayed = [];
		},
		saveSettings: function(){
			localStorage.channel = this.settings.channel;
			localStorage.user = this.settings.user;
			localStorage.OAUTH_TOKEN = this.settings.OAUTH_TOKEN;
			localStorage.keyword = this.settings.keyword;
		},
		timeSince: function(date) {
		  var seconds = Math.floor((new Date() - date) / 1000);
		  var interval = Math.floor(seconds / 31536000);
		  if (interval > 1) {
			return interval + " years";
		  }
		  interval = Math.floor(seconds / 2592000);
		  if (interval > 1) {
			return interval + " months";
		  }
		  interval = Math.floor(seconds / 86400);
		  if (interval > 1) {
			return interval + " days";
		  }
		  interval = Math.floor(seconds / 3600);
		  if (interval > 1) {
			return interval + " hours";
		  }
		  interval = Math.floor(seconds / 60);
		  if (interval > 1) {
			return interval + " minutes";
		  }
		  return Math.floor(seconds) + " seconds";
		},
        logusersQueued: function () {
            var output = [];
            this.usersQueued.forEach(function (item) {
                var ouputItem = {
                    name: item.name,
                    value: item.value,
					messageSent: item.messageSent
                };
                output.push(ouputItem);
            });
            console.table(output);
        }
    }
});

function connectChat(settings){
	ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443/', 'irc');
	BOT_OAUTH_TOKEN = settings.OAUTH_TOKEN;
	var temp = settings.user.trim();
	temp = temp.toLowerCase();
	BOT_USERNAME = temp;
	temp = settings.channel.trim();
	temp = temp.toLowerCase();
	CHANNEL = "#" + temp;

	ws.onmessage = function (message) {
		if (message !== null) {
		  var parsed = parseMessage(message.data);
		  if (parsed !== null) {
			if (parsed.command === "PRIVMSG") {
				console.log('MSG: ' + parsed.message + ' from ' + parsed.username);
				/*	regex? maybe?
					var  r = /!join/;
					var  m = parsed.message.match(r);
				*/
				if (app.settings.keyword.trim() ===  parsed.message.trim()) {
					app.addUser(parsed);
				}
			} else if (parsed.command === "PING") {
			  ws.send("PONG :" + parsed.message);
			}
		  }
		}
	};
	ws.onerror = function (message) {
		updateStatus()
		console.log('Error: ' + message);
	};
	ws.onclose = function () {
		console.log('Disconnected from the chat server.');
		updateStatus()
	};
	ws.onopen = function () {
		if (ws !== null && ws.readyState === 1) {
		  console.log('Connecting and authenticating...');

		  ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership');
		  ws.send('PASS ' + BOT_OAUTH_TOKEN);
		  ws.send('NICK ' + BOT_USERNAME);
		  ws.send('JOIN ' + CHANNEL);
		}
		updateStatus()
	};
}

function sentMessageToChat(message) {
  if (ws) {
	ws.send("PRIVMSG " + CHANNEL + " :" + message + '\r\n');
  } else {
	console.log(message);
  }
}

function sentWhisper(target,message) {
  if (ws) {
	ws.send("PRIVMSG " + CHANNEL + " :" + "/w " + target + " " + message + '\r\n');
  } else {
	console.log(message);
  }
}

function parseMessage(rawMessage) {
  var parsedMessage = {
	message: null,
	tags: null,
	command: null,
	original: rawMessage,
	channel: null,
	username: null
  };

  if(rawMessage[0] === '@'){
	var tagIndex = rawMessage.indexOf(' '),
	  userIndex = rawMessage.indexOf(' ', tagIndex + 1),
	  commandIndex = rawMessage.indexOf(' ', userIndex + 1),
	  channelIndex = rawMessage.indexOf(' ', commandIndex + 1),
	  messageIndex = rawMessage.indexOf(':', channelIndex + 1);

	parsedMessage.tags = rawMessage.slice(0, tagIndex);
	parsedMessage.username = rawMessage.slice(tagIndex + 2, rawMessage.indexOf('!'));
	parsedMessage.command = rawMessage.slice(userIndex + 1, commandIndex);
	parsedMessage.channel = rawMessage.slice(commandIndex + 1, channelIndex);
	parsedMessage.message = rawMessage.slice(messageIndex + 1);
  } else if(rawMessage.startsWith("PING")) {
	parsedMessage.command = "PING";
	parsedMessage.message = rawMessage.split(":")[1];
  }

  return parsedMessage;
}
function updateStatus(){
	var element = document.getElementById("status");
	app.connectionOpen = false;
	if(ws.readyState === ws.CONNECTING){
		element.innerHTML = "Connecting";
		element.className = "tag is-info";
	}
	if(ws.readyState === ws.OPEN){
		app.connectionOpen = true;
		element.innerHTML = "Connected";
		element.className = "tag is-success";
	}
	if(ws.readyState === ws.CLOSING){
		element.innerHTML = "Closing";
		element.className = "tag is-warning";
	}
	if(ws.readyState === ws.CLOSED){
		element.innerHTML = "Disconected";
		element.className = "tag is-danger";
	}
}
