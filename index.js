require('dotenv').config()
const { STICKER, BOT_API, WEATHER_API, MONGODB_URI } = process.env

const { MongoClient } = require('mongodb')
const client = new MongoClient(MONGODB_URI)

client.connect()
const db = client.db('weather-bot')

const users = db.collection('users')
const info = db.collection('info')

const axios = require('axios')
const TelegramApi = require('node-telegram-bot-api')

const token = BOT_API
const bot = new TelegramApi(token, { polling: true })

function translit(word){
	let answer = ''
	let converter = {
		'а': 'a',    'б': 'b',    'в': 'v',    'г': 'g',    'д': 'd',
		'е': 'e',    'ё': 'e',    'ж': 'zh',   'з': 'z',    'и': 'i',
		'й': 'y',    'к': 'k',    'л': 'l',    'м': 'm',    'н': 'n',
		'о': 'o',    'п': 'p',    'р': 'r',    'с': 's',    'т': 't',
		'у': 'u',    'ф': 'f',    'х': 'h',    'ц': 'c',    'ч': 'ch',
		'ш': 'sh',   'щ': 'sch',  'ь': '',     'ы': 'y',    'ъ': '',
		'э': 'e',    'ю': 'yu',   'я': 'ya',
 
		'А': 'A',    'Б': 'B',    'В': 'V',    'Г': 'G',    'Д': 'D',
		'Е': 'E',    'Ё': 'E',    'Ж': 'Zh',   'З': 'Z',    'И': 'I',
		'Й': 'Y',    'К': 'K',    'Л': 'L',    'М': 'M',    'Н': 'N',
		'О': 'O',    'П': 'P',    'Р': 'R',    'С': 'S',    'Т': 'T',
		'У': 'U',    'Ф': 'F',    'Х': 'H',    'Ц': 'C',    'Ч': 'Ch',
		'Ш': 'Sh',   'Щ': 'Sch',  'Ь': '',     'Ы': 'Y',    'Ъ': '',
		'Э': 'E',    'Ю': 'Yu',   'Я': 'Ya'
	}
 
	for (let i = 0; i < word.length; ++i ) {
		if (converter[word[i]] == undefined){
			answer += word[i]
		} else {
			answer += converter[word[i]]
		}
	}
 
	return answer
}

let isPost = false

bot.on('message', async (msg) => {
    const text = msg.text
    const chatId = msg.chat.id

    if (text === '/start') {
        await bot.sendSticker(chatId, STICKER)
        await bot.sendMessage(chatId,
            `👋 Привет ${msg.from.first_name}${(msg.from.last_name === undefined) ? '': ` ${msg.from.last_name}`}!\n` +
            '🌤 Это погодный бот.\n' +
            '👨‍💻 Автор: @SmartMainnet'
        )
        await bot.sendMessage(chatId,
            'Отправь мне название города,\n' +
            'например Москва,\n' +
            'чтобы узнать его погоду.'
        )

        await users.findOne({ id: chatId }).then(async res => {
            if (res === null) {
                await users.insertOne({
                    id: chatId,
                    username: msg.from.username,
                    first_name: msg.from.first_name,
                    last_name: msg.from.last_name,
                    start_date: new Date(),
                    calls: 0
                })
                await info.updateOne({}, { $inc: { users: 1 } })
            }
        })
    } else if (text === '/post' && msg.from.username === 'SmartMainnet') {
        await bot.sendMessage(chatId, 'Отправь мне пост')
        isPost = true
    } else if (isPost === true && msg.from.username === 'SmartMainnet') {
        users.find().toArray(async (err, res) => {
            for (let user of res) {
                let chatId = user.id
                await bot.sendMessage(chatId, text)
            }
        })
        isPost = false
    } else {
        await users.findOne({ id: chatId }).then(async res => {
            if (res === null) {
                await users.insertOne({
                    id: chatId,
                    username: msg.from.username,
                    first_name: msg.from.first_name,
                    last_name: msg.from.last_name,
                    start_date: new Date(),
                    calls: 0
                })
                await info.updateOne({}, { $inc: { users: 1 } })
            }
        })

        try {
            let city = translit(text)
            let url = `http://api.openweathermap.org/data/2.5/weather?q=${city}&lang=ru&units=metric&appid=${WEATHER_API}`

            await axios.get(url).then(async res => {
                await bot.sendMessage(chatId,
                    `☁️ Погода: ${res.data.weather[0].description}\n` +
                    `☀️ Температура: ${Math.round(res.data.main.temp)}°C\n` +
                    `💨 Ветер: ${(res.data.wind.speed / 3.6).toFixed(1)} м/с\n` +
                    `💧 Влажность: ${res.data.main.humidity}%\n`
                )
            })

            await users.updateOne({ id: chatId },
                {
                    $set: {
                        username: msg.from.username,
                        first_name: msg.from.first_name,
                        last_name: msg.from.last_name,
                        date_last_call: new Date(),
                        last_call: text
                    },
                    $inc: { calls: 1 }
                }
            )
            await info.updateOne({}, { $inc: { calls: 1 } })
        } catch {
            await bot.sendMessage(chatId, 'Это не город!')
        }
    }
})