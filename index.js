require('dotenv').config()
const { START_MESSAGE, ERROR_MESSAGE, STICKER, BOT_API, WEATHER_API, MONGO_PASS } = process.env

const TelegramApi = require('node-telegram-bot-api')
const axios = require('axios')

const { MongoClient } = require('mongodb')
const url = `mongodb+srv://admin:${MONGO_PASS}@database.owkg3.mongodb.net/test`

const client = new MongoClient(url)
client.connect()

const db = client.db('weather-bot')

const users = db.collection('users')
const info = db.collection('info')

const token = BOT_API
const bot = new TelegramApi(token, { polling: true })

function translit(word){
	var answer = '';
	var converter = {
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
	};
 
	for (var i = 0; i < word.length; ++i ) {
		if (converter[word[i]] == undefined){
			answer += word[i];
		} else {
			answer += converter[word[i]];
		}
	}
 
	return answer;
}

bot.on('message', async (msg) => {

    const text = msg.text
    const chatId = msg.chat.id

    if (text === '/start') {

        await bot.sendSticker(chatId, STICKER)
        await bot.sendMessage(chatId,
            `Привет ${msg.from.first_name}${(msg.from.last_name === undefined) ? '': ` ${msg.from.last_name}`}!`
            + '\n' +
            'Это погодный бот.'
            + '\n' +
            'Автор: @SmartMainnet'
        )
        await bot.sendMessage(chatId, START_MESSAGE)

        const document = await users.findOne({ id: chatId })

        if (document === null) {
            await users.insertOne({
                id: chatId,
                username: msg.from.username
            })
            await info.updateOne({}, { $inc: { users: 1 } })
        }
    
    } else {

        try {

            let city = translit(text)
            let url = `http://api.openweathermap.org/data/2.5/weather?q=${city}&lang=ru&units=metric&appid=${WEATHER_API}`

            await axios.get(url).then(async res => {
                await bot.sendMessage(chatId,
                    `Погода: ${Math.round(res.data.main.temp)}°C  -  ${res.data.weather[0].description}`
                    + '\n' +
                    `Ветер: ${res.data.wind.speed} км/ч`
                    + '\n' +
                    `Влажность: ${res.data.main.humidity}%`
                )
            })

            await info.updateOne({}, { $inc: { calls: 1 } })

        } catch {
            await bot.sendMessage(chatId, ERROR_MESSAGE)
        }

    }

})