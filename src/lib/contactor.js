import Onebot from './adapter/onebot.js';
import Openai from './adapter/openai.js';
import EventEmmiter from './event.js';

export default class Contactor extends EventEmmiter {
    /**
     * Constructor of Contactor class
     * @param {string} platform - Platform of contactor
     * @param {object} config - Configuration of contactor
     * @param {string} config.id - ID of the contactor
     * @param {string} config.name - Name of the contactor
     * @param {string} config.avatar - Avatar of the contactor
     * @param {string} config.title - Title of the contactor
     * @param {object} config.options - Options of the contactor
     * @param {number} config.priority - Priority of the contactor,from 0 to 1, 0 means highest priority
     */
    constructor(platform, config) {
        super();
        this.platform = platform;
        this.id = config.id;
        this.name = config.name;
        this.avatar = config.avatar;
        this.title = config.title;
        this.options = config.options;
        this.priority = config.priority;
        this.firstMessageIndex = 0;
        this.messageChain = config.messageChain || [];
        this.active = false;
        this.activeModel = undefined;

        this.kernel = this.platform == 'onebot' ?
            new Onebot(config) :
            new Openai(config) ;

        if(this.platform == 'openai')
            this.enableOpenaiListener()
    }

    enableOpenaiListener() {
        
        this.kernel.on('updateMessage', (e) => {
            let updatedMessage
            const messageIndex = e.index
            const chunk = e.chunk
            const rawMessage = this.messageChain[messageIndex]
            if(rawMessage){
                if(rawMessage.content.text.length == 0) rawMessage.content.text.push('')
                // 拼接
                updatedMessage = rawMessage.content.text[0].concat(chunk)
                
            }
                this.emit('updateMessage', {messageIndex: messageIndex, updatedMessage: updatedMessage});

        });


        this.kernel.on('completeMessage', (e) => {
            const messageIndex = e.index
            const rawMessage = this.messageChain[messageIndex]
            if(rawMessage){
                this.emit('completeMessage',{text:rawMessage.content.text[0],index:messageIndex});
            }
        })
        this.kernel.on('failedMessage', (e) => {
            const messageIndex = e.index
            const rawMessage = this.messageChain[messageIndex]
            if(rawMessage){
                this.emit('completeMessage', {text:e.error,index:messageIndex});
            }
        })
    }

    /**
     * Send message to contactor
     * @param {OnebotMessage} message 
     */
    async send(message) {
        await this.kernel.send(message);
    }

    /**
     * 从网页前端发来的消息
     */
    async webSend(message){
        console.log(message)
        this.messageChain.push(message)
        if(this.platform == 'onebot'){
            return await this.kernel.send(this.id,message.content)
        }else{
            // 截取从this.firstMessageIndex到结尾的消息
            const cuttedMessageList = this.messageChain.slice(this.firstMessageIndex)
            const textMessageList = cuttedMessageList.filter(msg => msg.content.text.length)
            const validMessageList = textMessageList.filter(msg => msg.role!= 'system')
            const openaiMessageList = validMessageList.map(msg => {
                return {
                    role: msg.role == 'user' ? 'user' : 'assistant',
                    content: msg.content.text[0]
                }
            })

            // 立即发生回复消息
            this.revMessage({message:[]}) 

            const settings = {
                model: this.activeModel,
            }

            const replyIndex = this.messageChain.length - 1
            this.kernel.send(openaiMessageList,replyIndex,settings)

            return Math.floor(Math.random() * 100000000).toString().padStart(8, '0')
        }
    }
        

    /**
     * 接收到消息
     * @param {string} id - ID of the contactor
     * @param {object} message - Message received from contactor
     */
    revMessage(message) {
        const webMessage = this.kernel.convertMessage(message)
        console.log(`收到消息，id:${this.id},激活状态:${this.active}`)
        console.log(webMessage)
        
        if(!this.active) this.messageChain.push(webMessage)
        else this.emit('revMessage', webMessage)
        
        console.log(this.messageChain)
        return webMessage
    }

    /**
     * 删除消息
     * @param {string} message_id - ID of the message to be deleted
     * @returns {boolean} - Whether the message is successfully deleted
     */
    delMessage(message_id){
        for (let i = 0; i < this.messageChain.length; i++) {
            if (this.messageChain[i].id === message_id) {
                this.emit('delMessage',i)
                this.makeSystemMessage(`${this.name}撤回了一条消息`)
                return true;   // 删除成功
            }
        }
        return false;  // 没有找到要删除的消息
    }

    makeSystemMessage(text) {
        const container = {
            role: "system",
            time: new Date().getTime(),
            id: new Date().getTime(),
            content: {
                voice: [],
                image: [],
                text: [text]
            }
        }
        this.emit('revMessage',container)

    }

    getLastTime() {
        const last = this.messageChain[this.messageChain.length - 1]
        if (!last) {
            return '';
        }

        const currentTime = new Date().getTime();
        const lastTime = new Date(last.time);
        const timeDiff = currentTime - lastTime.getTime();

        if (timeDiff < 24 * 60 * 60 * 1000) {
            this.toinit = false
            // 小于24小时，返回 xx:xx (小时:分钟)
            const hours = lastTime.getHours().toString().padStart(2, '0');
            const minutes = lastTime.getMinutes().toString().padStart(2, '0');
            return `${hours}:${minutes}`;
        } else if (timeDiff < 48 * 60 * 60 * 1000) {
            // 小于48小时，显示昨天
            return '昨天';
        } else if (timeDiff < 7 * 24 * 60 * 60 * 1000) {
            // 小于7天，返回星期x
            const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
            const weekday = lastTime.getDay();
            return `星期${weekdays[weekday]}`;
        } else {
            // 7天以上，返回xxxx/xx/xx（年/月/日）
            const year = lastTime.getFullYear();
            const month = (lastTime.getMonth() + 1).toString().padStart(2, '0');
            const day = lastTime.getDate().toString().padStart(2, '0');
            return `${year}/${month}/${day}`;
        }
    }

    getShownTime(timestamp) {
        const currentTime = new Date().getTime();
        // 如果传入时间和当前时间差在24h以内，则显示时间

        const timeDiff = currentTime - timestamp;
        if (timeDiff < 24 * 60 * 60 * 1000) {
            const hours = new Date(timestamp).getHours().toString().padStart(2, '0');
            const minutes = new Date(timestamp).getMinutes().toString().padStart(2, '0');
            return `${hours}:${minutes}`;
        } else if (timeDiff < 48 * 60 * 60 * 1000) {
            // 小于48小时，显示昨天+时间
            const hours = new Date(timestamp).getHours().toString().padStart(2, '0');
            const minutes = new Date(timestamp).getMinutes().toString().padStart(2, '0');
            return `昨天${hours}:${minutes}`;
        }else if (timeDiff < 7 * 24 * 60 * 60 * 1000) {
            // 小于7天，返回星期x+时间
            const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
            const weekday = new Date(timestamp).getDay();
            const hours = new Date(timestamp).getHours().toString().padStart(2, '0');
            const minutes = new Date(timestamp).getMinutes().toString().padStart(2, '0');
            return `星期${weekdays[weekday]}${hours}:${minutes}`;
        } else {
            // 7天以上，返回xxxx/xx/xx（年/月/日）+时间
            const year = new Date(timestamp).getFullYear();
            const month = (new Date(timestamp).getMonth() + 1).toString().padStart(2, '0');
            const day = new Date(timestamp).getDate().toString().padStart(2, '0');
            const hours = new Date(timestamp).getHours().toString().padStart(2, '0');
            const minutes = new Date(timestamp).getMinutes().toString().padStart(2, '0');
            return `${year}/${month}/${day} ${hours}:${minutes}`;
        }
    }

    getLastContent() {
        const msg = this.messageChain[this.messageChain.length - 1]
        if (!msg) return ''
        let type = '';
        if (msg.content.text.length) {
            type = msg.content.text[0]
        } else if (msg.content.image.length) {
            type = "[图片]"
        } else {
            type = '[语音]'
        }
        return type;
    }

    updateFirstMessage(){
        this.firstMessageIndex = this.messageChain.length - 1
    }

}