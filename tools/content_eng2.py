"""English mock variants 6–8 in the NMT-2026 layout (same parts as variants 4–5).
Writes src/content/31-eng-mocks-2.json."""
import collections, json, os, random

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
questions, sets = [], []


def add(vid, part, topic, fmt, prompt, passage, options, answer, explanation, level, group):
    n = len([q for q in questions if q['id'].startswith(f'eng-v{vid}-{part}-')]) + 1
    questions.append({'id': f'eng-v{vid}-{part}-{n}', 'subject': 'eng', 'topicId': topic, 'type': 'single', 'format': fmt,
                      'prompt': prompt, 'passage': passage, 'options': list(options), 'answer': answer, 'explanation': explanation,
                      'level': level, 'tags': [fmt, 'use-of-english' if fmt == 'gapfill' else 'reading'], 'groupId': group})
    return questions[-1]['id']


def headings(vid, options, notices):
    return [add(vid, 'notice', 'eng-matching', 'matching', 'Оберіть заголовок, що найточніше відповідає оголошенню. Три варіанти в блоці зайві.',
                text, options, options.index(key), ex, 2, f'eng-v{vid}-notices') for text, key, ex in notices]


def reading(vid, text, items):
    return [add(vid, 'read', 'eng-reading', 'reading', prompt, text, opts, 0, ex, 3, f'eng-v{vid}-text') for prompt, opts, ex in items]


def gapped(vid, part, first, text, options, explanations):
    return [add(vid, part, 'eng-cohesion', 'gapfill', f'Choose the best option (A–H) for gap [{first + i}]. Two options are extra.',
                text, options, i, ex, 3, f'eng-v{vid}-{part}') for i, ex in enumerate(explanations)]


def cloze(vid, part, topic, first, text, items):
    return [add(vid, part, topic, 'gapfill', f'Choose the correct option for gap [{first + i}].', text, opts, 0, ex, 2, f'eng-v{vid}-{part}')
            for i, (opts, ex) in enumerate(items)]


# ---------------------------------------------------------------- Variant 6
v = 6
s = []
s += headings(v, ['Tickets are cheaper for a limited time', 'A change of venue', 'A service that is free of charge', 'Something has been found',
                  'Help is needed', 'Registration closes soon', 'A warning about safety', 'A new rule for members'], [
    ('Watch your step: the floor in the east corridor has just been polished and may be slippery until 3 p.m.', 'A warning about safety',
     'Ключові слова: watch your step, slippery — попередження про небезпеку. Про правила для членів клубу чи знахідки тут не йдеться.'),
    ('Early-bird offer: buy your festival pass before 1 June and pay 30% less than the standard price.', 'Tickets are cheaper for a limited time',
     'Pay 30% less … before 1 June — знижка діє обмежений час. Це не «Registration closes soon»: квитки можна купити й пізніше, лише дорожче.'),
    ('From next month, all gym members must scan their card at the entrance. Paper passes will no longer be accepted.', 'A new rule for members',
     'All gym members must scan their card — нове правило для членів клубу. Місце занять не змінюється.'),
    ('The book club will meet in the café on Green Street this Thursday because the library is closed for painting.', 'A change of venue',
     'Зустріч переносять з бібліотеки до кав’ярні — змінилося місце. Дата лишилася та сама, тож це не скасування.'),
    ('Our students offer free help with smartphones and email every Wednesday afternoon. No appointment needed.', 'A service that is free of charge',
     'Free help — безкоштовна послуга. Це не «Help is needed»: допомогу пропонують, а не шукають.'),
])
text6 = """Three years ago, Marko Hnatiuk was asked to write a school report on insects. He chose bees because he thought it would be easy. Instead, he discovered that wild bees in his city were disappearing faster than anyone had expected, mainly because there were too few flowers between the parks.

Marko's idea was simple: if the parks were islands, the bees needed bridges. He drew a map of the empty spaces that separated them – bus-stop roofs, school fences, the narrow strips of grass beside the tram line – and calculated that planting wild flowers on just a fraction of them would create an unbroken 'corridor' across the city.

The city council liked the map but said it had no money for the project. Marko did not give up. He sent his plan to local businesses and asked each of them to 'adopt' one small patch. A bakery paid for seeds, a building company lent a truck, and a retired gardener offered to train volunteers. Within a year, more than two hundred patches had been planted.

Not everyone was enthusiastic. Some residents complained that the wild flowers looked untidy compared with neatly cut lawns, and one neighbour worried that the bees would sting children. Marko responded by putting up small signs explaining that most wild bees are gentle and that the 'messy' look was exactly what the insects needed.

Scientists from the local university now count the bees every summer. Their figures show that the number of species visiting the corridor has almost doubled, although they warn that one good year does not prove a long-term trend. Marko, now seventeen, says the project taught him something unexpected. 'I thought my job was to understand bees,' he says. 'It turned out the hardest part was understanding people – and persuading them to change their minds.'"""
s += reading(v, text6, [
    ('What did Marko discover while writing his report?', ['Wild bees were disappearing because there were too few flowers between the parks.', 'Bees prefer school gardens to city parks.',
     'Insects are easy to study in a city.', 'Several parks in his city were being closed.'],
     'Доказ: wild bees … were disappearing … mainly because there were too few flowers between the parks. Що комах легко вивчати, Марко лише думав спочатку; про закриття парків не сказано.'),
    ("What was the council's reaction to the plan?", ['It liked the idea but could not pay for it.', 'It rejected the map as unrealistic.',
     'It was worried that bees would sting children.', 'It wanted the lawns to stay neatly cut.'],
     'The city council liked the map but said it had no money. Скарги на укуси й неохайний вигляд — від мешканців, а не від ради.'),
    ('How was the corridor finally created?', ['With help from local businesses and volunteers.', "By the university's scientists.",
     "By the council's own gardeners.", 'By Marko working on his own.'],
     'Пекарня оплатила насіння, будівельна компанія дала вантажівку, садівник навчав волонтерів. Науковці лише рахують бджіл.'),
    ('How did Marko respond to complaints from residents?', ['He put up signs explaining why the flowers looked the way they did.', 'He removed the flowers near schools.',
     'He asked the council to cut the grass.', 'He moved the patches away from homes.'],
     'Marko responded by putting up small signs explaining… Квіти він не прибирав і ділянок не переносив.'),
    ('What does Marko say was the hardest part of the project?', ['Persuading people to change their minds.', 'Understanding how bees live.',
     'Finding enough flower seeds.', 'Counting the bees every summer.'],
     "The hardest part was understanding people – and persuading them. Він думав, що головне — зрозуміти бджіл, але виявилося інакше."),
])
s += gapped(v, 'sent', 11, """Almost everyone has put off an important task until the last minute. [11] Researchers now believe that procrastination is less about time and more about emotions.

When a task makes us feel bored, anxious or unsure, our brain looks for a quick way to feel better. [12] The relief is real, but it lasts only a few minutes, and the task is still waiting.

Interestingly, people who procrastinate are often not lazy at all. [13] They delay starting because they are afraid the result will not be good enough.

So what helps? One effective method is to make the first step ridiculously small. [14] Once we have started, continuing is usually much easier than we expected.

Another strategy is to be kind to yourself after a delay. [15] Students who forgave themselves for procrastinating before one exam were less likely to do it again before the next.

Finally, it helps to remove temptations before you begin. [16] Out of sight really can mean out of mind.""",
    ['Many people think it simply shows poor time management.', 'Checking a phone or tidying the desk provides exactly that.',
     'Many are perfectionists who set themselves extremely high standards.', "Instead of 'write the essay', the goal becomes 'write one sentence'.",
     'This may sound surprising, but research supports it.', 'Leaving your phone in another room removes the most common distraction.',
     'Most students finish their homework long before the deadline.', 'Good time management apps are usually very expensive.'],
    ['Після загального факту — поширена думка (погане планування часу), яку наступне речення спростовує: насправді причина в емоціях.',
     'Мозок шукає швидкий спосіб почуватися краще → телефон чи прибирання дають саме це (exactly that); далі — «полегшення справжнє, але коротке».',
     'Прокрастинатори не ліниві → часто це перфекціоністи; наступне речення пояснює: бояться, що результат буде недостатньо добрим.',
     'Зробити перший крок смішно малим → приклад: не «написати есе», а «написати одне речення».',
     'Бути добрим до себе — порада, що звучить несподівано, тому далі дослідження її підтверджує.',
     'Прибрати спокуси → телефон в іншій кімнаті; out of sight, out of mind. Речення про домашнє завдання й дорогі застосунки не пов’язані з текстом.'])
s += gapped(v, 'phrase', 17, """For decades, night trains in Europe seemed to belong to the past. Cheap flights were faster, and many railway companies [17]. Recently, however, the sleeper train has made a surprising comeback.

One reason is concern about climate change. A journey by train produces far less carbon dioxide than the same trip by plane, [18]. Another is comfort: passengers can board in the city centre in the evening and wake up [19], without airport queues or security checks.

Not everything is perfect. Tickets are often more expensive than flights, [20], and the cabins are small. Some routes also suffer from delays [21].

Still, demand is growing, and several new routes have opened in the last few years. For many travellers, the night train offers something a plane cannot: the chance to treat the journey [22].""",
    ['stopped running them because they were losing money', 'which matters to a growing number of travellers', 'at their destination the next morning',
     'especially when booked at the last minute', 'because they cross several countries with different rail systems', 'as part of the holiday rather than a waste of time',
     'so most passengers prefer to travel by car', 'which was built more than a hundred years ago'],
    ['Many railway companies … stopped running them — пояснює, чому нічні потяги «залишилися в минулому».',
     'Менше вуглекислого газу — це важливо (matters) для багатьох мандрівників; which відсилає до всього попереднього факту.',
     'Wake up at their destination the next morning — сіли ввечері, прокинулися на місці.',
     'Квитки дорожчі, особливо якщо купувати в останню мить — уточнення до ціни.',
     'Затримки — бо маршрути перетинають кілька країн з різними залізницями. Варіант про будівлю граматично не пасує до delays.',
     'Treat the journey as part of the holiday — подорож як частина відпочинку. Варіант про авто суперечить змісту тексту.'])
s += cloze(v, 'grammar', 'eng-tenses', 23, """My grandmother's garden

My grandmother [23] in the same village all her life. Every summer, when I was a child, my parents [24] me to stay with her for a month. She taught me how to grow tomatoes, [25] I still do today. Last year she [26] a prize at the local flower show, and she was so proud that she framed the certificate. If she [27] younger, she says, she would start a business selling her plants.""", [
    (['has lived', 'lives', 'had been living', 'is living'], 'All her life — період до теперішнього, і бабуся досі там живе: Present Perfect has lived. Had been living потребує іншої минулої події.'),
    (['used to send', 'were sending', 'have sent', 'send'], 'Повторювана дія в минулому (every summer, when I was a child) — used to send. Were sending описує процес у конкретний момент.'),
    (['which', 'what', 'who', 'that'], 'Після коми відносний займенник, що стосується всієї попередньої дії: which. That після коми не вживаємо, what не вводить такого речення.'),
    (['won', 'has won', 'had won', 'wins'], 'Last year — завершена подія в минулому: Past Simple won.'),
    (['were', 'is', 'had been', 'will be'], 'Уявна теперішня умова (would start) — Second Conditional: if she were younger.'),
])
s += cloze(v, 'vocab', 'eng-vocabulary', 28, """Choosing a university

Choosing a university is one of the biggest decisions young people [28]. It is worth visiting several campuses before you [29] your mind. Talk to current students: they can [30] you an honest picture of everyday life. Do not forget to [31] into account the cost of living in the city, not just the tuition fees. Finally, remember that a course you are genuinely interested in will be much easier to [32] with for three or four years.""", [
    (['make', 'do', 'give', 'put'], 'Стале сполучення make a decision.'),
    (['make up', 'take up', 'set up', 'give up'], 'Make up your mind — ухвалити рішення. Take up — почати займатися, set up — заснувати, give up — здатися.'),
    (['give', 'say', 'tell', 'speak'], 'Give somebody a picture of something — дати уявлення. Say і speak не мають двох додатків, tell не поєднується з picture.'),
    (['take', 'bring', 'hold', 'put'], 'Стале сполучення take into account — брати до уваги.'),
    (['stick', 'keep', 'hold', 'go'], 'Stick with something — не кидати, триматися обраного.'),
])
sets.append(s)

# ---------------------------------------------------------------- Variant 7
v = 7
s = []
s += headings(v, ['Volunteers are wanted', 'Bring your own food', 'Not open to the public', 'An event has been cancelled',
                  'Children travel free', 'Please return it', 'Book in advance online', 'A reminder about a deadline'], [
    ("Sorry! Saturday's open-air concert will not take place due to the storm warning. All tickets will be refunded automatically.", 'An event has been cancelled',
     'Will not take place — концерт скасовано; кошти повернуть автоматично, тож бронювати нічого не треба.'),
    ("Has anyone borrowed the blue toolbox from the workshop? It's needed for Monday's class – please put it back on the shelf.", 'Please return it',
     'Please put it back — прохання повернути річ. Волонтерів тут не шукають.'),
    ("We're looking for friendly people to help at the charity run on 12 May. You'll hand out water and cheer runners on.", 'Volunteers are wanted',
     'Looking for people to help — шукають волонтерів. Про їжу йдеться лише як про воду для бігунів.'),
    ('Applications for the summer language camp must be received by Friday at noon. Late forms cannot be accepted.', 'A reminder about a deadline',
     'Must be received by Friday at noon — крайній строк. Це не «Book in advance online»: про онлайн-бронювання не сказано.'),
    ('This area is for staff only. Visitors must stay behind the yellow line at all times.', 'Not open to the public',
     'For staff only — сюди не пускають відвідувачів.'),
])
text7 = """When I was fifteen, my mother broke her arm, and for six weeks I had to cook dinner for our family of five. I had never followed a recipe before, and my first attempts were not a success. On the second evening, I burnt the rice so badly that we had to open every window in the flat.

What surprised me was how much maths was hidden in the kitchen. Most recipes in my grandmother's notebook were written for four people, so I constantly had to multiply or divide the quantities. When a recipe asked for 300 grams of flour and our scales were broken, I had to work out how many spoonfuls that would be. For the first time, fractions stopped being symbols on a page and became something I could touch and taste.

My maths teacher noticed the change before I did. My marks did not improve immediately, but I started asking different questions in class – practical ones, like how much paint you would need for a room. She told me that this was the kind of thinking the exam actually rewarded.

Cooking also taught me to plan. A good dinner is like a timetable: the potatoes need forty minutes, the salad five, and everything has to be ready at the same moment. I began organising my revision in the same way, starting with the subjects that needed the most time.

My mother's arm healed long ago, but I still cook twice a week. My brothers complain that I talk about ratios at the dinner table. I tell them it is the price they pay for a good meal."""
s += reading(v, text7, [
    ('Why did the writer start cooking?', ['Her mother was unable to cook for several weeks.', 'She wanted to become a professional chef.',
     'Her grandmother asked her to learn.', 'Her school gave her a cooking project.'],
     'My mother broke her arm, and for six weeks I had to cook. Інших причин у тексті немає.'),
    ('What does she say about her first attempts?', ['Some of them went badly wrong.', 'They were better than she had expected.',
     'Her brothers helped her with them.', 'She followed the recipes exactly.'],
     'My first attempts were not a success… I burnt the rice so badly. Вона раніше ніколи не готувала за рецептом.'),
    ('How did cooking change her attitude to fractions?', ['They became real and practical for her.', 'She found them harder than before.',
     'She stopped needing them.', 'She used them only for baking.'],
     'Fractions stopped being symbols on a page and became something I could touch and taste.'),
    ('What did her maths teacher notice?', ['She was asking more practical questions.', 'Her marks had improved at once.',
     'She was too tired to concentrate.', 'She was cooking at school.'],
     'I started asking different questions in class – practical ones. Оцінки не покращилися одразу (did not improve immediately).'),
    ('How did cooking influence the way she revised?', ['She began planning her time more carefully.', 'She revised only in the kitchen.',
     'She stopped revising maths.', 'She studied together with her brothers.'],
     'I began organising my revision in the same way — як розклад приготування вечері, починаючи з предметів, що потребують найбільше часу.'),
])
s += gapped(v, 'sent', 11, """Standing in front of a class can make even confident students nervous. The good news is that presenting is a skill, not a talent you are born with. [11]

Start by thinking about your audience rather than yourself. [12] If you know what they want to learn, you will find it much easier to decide what to include.

Next, plan a clear structure. [13] Listeners remember a talk far better when they can see where it is going.

Slides can help, but only if they are simple. [14] Your audience cannot read and listen at the same time.

Practise out loud, ideally in front of a friend or family member. [15] It will also show you which parts are too long.

Finally, accept that you will feel some nerves. [16] A little adrenaline can actually make you sound more energetic.""",
    ['Like any skill, it improves with practice and a few simple techniques.', 'Ask yourself what they already know and what might interest them.',
     'Tell them at the beginning what you are going to cover.', 'A slide full of long sentences is more likely to distract than help.',
     'Hearing yourself speak helps you notice words you stumble over.', 'Even experienced speakers say they never completely lose them.',
     'Most teachers prefer written reports to presentations.', 'Reading your notes word for word is the safest approach.'],
    ['Presenting is a skill → як будь-яка навичка, покращується практикою.',
     'Думай про аудиторію → запитай себе, що вони вже знають і що їм цікаво; далі — «якщо знаєш, що вони хочуть дізнатися».',
     'Чітка структура → на початку скажи, про що говоритимеш; слухачі бачать, куди рухається виступ.',
     'Прості слайди → слайд з довгими реченнями відволікає; аудиторія не може одночасно читати й слухати.',
     'Практикуйся вголос → чуєш, на яких словах спотикаєшся; also — ще й видно задовгі частини.',
     'Хвилювання буде → навіть досвідчені промовці не позбуваються його (them = nerves). Порада читати нотатки дослівно суперечить тексту.'])
s += gapped(v, 'phrase', 17, """Bike-sharing schemes now operate in hundreds of cities around the world. The idea is simple: you unlock a bike with an app, ride it across town and leave it [17].

Supporters say the schemes reduce traffic and pollution, [18]. In some cities, people who once drove short distances now cycle instead.

However, the first schemes faced serious problems. Bikes were often left blocking pavements, [19], and many were damaged or stolen. Some companies went out of business within a year.

Cities have learned from these mistakes. Many now require bikes to be returned to marked parking areas, [20]. Others have built more cycle lanes, [21].

Experts agree that bike-sharing works best when it is part of a wider plan. A bike is only useful [22].""",
    ['at a station or parking area near your destination', 'while also encouraging people to be more active', 'which made life difficult for pedestrians and wheelchair users',
     'and users who ignore this rule pay a fine', 'because many people do not feel safe cycling in traffic', 'if people can ride it safely to where they need to go',
     'so the schemes were closed in every city', 'which is why bikes are usually free for tourists'],
    ['Leave it at a station or parking area — де залишають велосипед.', 'Зменшують затори й забруднення, водночас заохочуючи рухатися.',
     'Велосипеди на тротуарах заважали пішоходам і людям на візках.', 'Правило повертати на стоянки — і штраф за порушення.',
     'Більше велодоріжок, бо багато хто боїться їздити в потоці машин.', 'Велосипед корисний, лише якщо ним безпечно доїхати куди треба. Варіант про закриття в усіх містах суперечить тексту.'])
s += cloze(v, 'grammar', 'eng-tenses', 23, """A message to a friend

Hi Max! Sorry I [23] you back yesterday – my phone battery was dead. I [24] for my exams all week, so I haven't had much free time. By the time you get this message, I [25] my last test! Shall we meet on Saturday? There's a new café near the station [26] everyone is talking about. If you [27] free, text me and we'll decide on a time.""", [
    (["didn't call", "haven't called", "don't call", "wasn't calling"], 'Yesterday — завершений минулий момент: Past Simple didn’t call.'),
    (['have been studying', 'studied', 'am studying', 'had studied'], 'All week і наслідок зараз (so I haven’t had much free time) — Present Perfect Continuous.'),
    (['will have finished', 'finish', 'will finish', 'have finished'], 'By the time you get this — дія завершиться до моменту в майбутньому: Future Perfect.'),
    (['that', 'who', 'where', 'what'], 'Означальне речення про предмет (café), який обговорюють: that. Where потребувало б іншої будови (where everyone meets).'),
    (['are', 'will be', 'were', 'would be'], 'Реальна умова в майбутньому — First Conditional: if + Present Simple, тож are.'),
])
s += cloze(v, 'vocab', 'eng-vocabulary', 28, """Saving energy at home

Small changes at home can [28] a big difference to your energy bills. For example, remember to [29] off lights when you leave a room. Washing clothes at a lower temperature uses less electricity and also helps them [30] longer. If your windows let in cold air, it may be worth investing in better insulation – it will [31] for itself within a few years. Most importantly, try to [32] these habits every day, not just when the bills arrive.""", [
    (['make', 'do', 'take', 'give'], 'Стале сполучення make a difference.'),
    (['switch', 'put', 'close', 'set'], 'Switch off — вимикати світло.'),
    (['last', 'stay', 'hold', 'remain'], 'Last longer — довше служити.'),
    (['pay', 'earn', 'cost', 'buy'], 'Pay for itself — окупитися.'),
    (['stick to', 'hold on', 'keep on', 'carry'], 'Stick to habits — дотримуватися звичок. Keep on потребує -ing, hold on — «зачекати».'),
])
sets.append(s)

# ---------------------------------------------------------------- Variant 8
v = 8
s = []
s += headings(v, ['Not suitable for beginners', 'Opening hours have changed', 'A lost pet', 'Equipment can be rented',
                  'The price includes a meal', 'Only for registered students', 'A space is available', 'Quiet is required'], [
    ('Ski and snowboard sets available for hire by the day or week at the reception desk.', 'Equipment can be rented',
     'Available for hire — спорядження можна взяти напрокат.'),
    ("Missing since Sunday: a small grey cat with a red collar answering to 'Smoke'. Please call if you see her.", 'A lost pet',
     'Missing … a small grey cat — загубилася тварина.'),
    ('Advanced climbing course: participants must already be able to lead a route without help.', 'Not suitable for beginners',
     'Advanced … must already be able — курс не для початківців. Про реєстрацію студентів не сказано.'),
    ('Room to rent in a shared flat near the university, available from 1 September.', 'A space is available',
     'Room to rent, available — є вільне місце. Це не «Only for registered students»: умови для орендаря не названі.'),
    ('Cooking evening: €15 per person, dinner and a drink included.', 'The price includes a meal',
     'Dinner and a drink included — у ціну входить їжа.'),
])
text8 = """In the small town of Ostrivka, history teacher Halyna Bondar had a problem: the nearest museum was eighty kilometres away, and most of her students had never visited it. 'They thought history was something that happened somewhere else, to other people,' she says.

Her solution was to turn the town itself into a museum. With her Year 10 class, she chose twelve places with a story to tell – the old mill, the railway station, a house where a famous poet had once stayed. The students interviewed older residents, searched the town archive and photographed old documents. Then they wrote a short text for each place and attached a sign with a code that visitors can scan with a phone.

The work was harder than anyone expected. Some stories turned out to be legends with no evidence behind them, and the students had to decide whether to include them. In the end they did, but with a clear note saying which parts could be proved and which could not. 'That discussion taught them more about how historians work than any textbook,' Halyna says.

The trail opened last spring, and the reaction surprised everyone. Tourists began to stop in Ostrivka on their way to the mountains, and a café near the station started selling postcards designed by the students. Several older residents, who had at first been shy about giving interviews, now offer to guide visitors themselves.

Halyna admits the project is far from finished. Two of the signs have already been damaged by the weather, and the texts exist only in Ukrainian. Next year's class plans to replace the signs and add English translations. 'A museum is never complete,' she says. 'Neither is a town's memory.'"""
s += reading(v, text8, [
    ('Why did Halyna start the project?', ['Her students thought history had nothing to do with their own town.', 'The regional museum asked her for help.',
     'The town council wanted more tourists.', 'Her class had to write about a famous poet.'],
     "They thought history was something that happened somewhere else, to other people. Туристи — несподіваний наслідок, а не причина."),
    ('How did the students collect information?', ['By interviewing older residents and searching the town archive.', 'Only from history textbooks.',
     'By visiting the regional museum.', 'By copying texts from other trails.'],
     'The students interviewed older residents, searched the town archive and photographed old documents.'),
    ('What did the students decide to do with the legends?', ['Include them with a note on what could be proved.', 'Leave them out completely.',
     'Replace them with new stories.', 'Tell them only to tourists.'],
     'In the end they did [include them], but with a clear note saying which parts could be proved.'),
    ('Which result of the trail was unexpected?', ['Older residents began to act as guides for visitors.', 'The regional museum closed.',
     'The students opened a café.', 'Visitors stole several signs.'],
     'Residents, who had at first been shy… now offer to guide visitors. Кав’ярня вже існувала й лише продає листівки учнів; таблички пошкодила погода, а не крадії.'),
    ('What problem does the project still have?', ['Some signs need replacing and the texts need translating.', 'Residents refuse to take part.',
     'Tourists do not scan the codes.', 'The trail has too many places on it.'],
     'Two of the signs have already been damaged… the texts exist only in Ukrainian — наступний клас замінить таблички й додасть переклади.'),
])
s += gapped(v, 'sent', 11, """Many parents encourage their children to learn a musical instrument, but the benefits go well beyond being able to play a tune. [11]

First, playing music trains the memory. [12] Over time, this makes it easier to remember other kinds of information too.

Music also teaches patience. [13] Learners discover that progress comes from regular practice, not sudden talent.

Playing in a group adds another advantage. [14] Musicians must listen carefully to one another and adjust their playing.

Of course, not every learner will become a professional. [15] Even adults who stopped playing years ago often say the skills stayed with them.

If you have always wanted to try, it is never too late to start. [16]""",
    ['Research suggests it can also improve concentration and confidence.', 'Musicians have to remember long sequences of notes and movements.',
     'A difficult piece may take weeks of daily effort to master.', 'In an orchestra or band, nobody can succeed alone.',
     'However, that was never the main point.', 'Many teachers offer lessons for complete beginners of any age.',
     'Most instruments are too expensive for schools to buy.', 'Singing is the only activity that has these effects.'],
    ['Користь більша за вміння зіграти мелодію → дослідження: ще й концентрація та впевненість.',
     'Музика тренує пам’ять → музиканти запам’ятовують довгі послідовності нот і рухів; this далі відсилає до цього.',
     'Музика вчить терпіння → складний твір потребує тижнів щоденної праці.',
     'Перевага гри в гурті → в оркестрі ніхто не досягне успіху сам; далі — слухати одне одного.',
     'Не кожен стане професіоналом → але це ніколи й не було головним; навички лишаються.',
     'Ніколи не пізно почати → уроки для початківців будь-якого віку. Речення про спів суперечить тексту.'])
s += gapped(v, 'phrase', 17, """Swimming in rivers, lakes and the sea, often called 'wild swimming', has become popular [17]. Many people say that cold water makes them feel more awake and helps them cope with stress.

However, swimming outdoors is very different from swimming in a pool. The water can be much colder [18], and currents can be strong even when the surface looks calm.

Experts advise beginners to swim with others [19]. It is also important to enter the water slowly, [20].

Water quality is another concern. After heavy rain, rivers can become polluted, [21].

With the right preparation, wild swimming can be a safe and enjoyable activity. As one experienced swimmer puts it, 'Respect the water, [22].'""",
    ['with people of all ages in recent years', 'than people expect, even in summer', 'and to stay close to the shore at first',
     'giving the body time to get used to the cold', 'so it is wise to check local reports before going in', 'and it will give you a great deal in return',
     'because pools are usually closed in winter', 'which is why swimming is forbidden in all rivers'],
    ['Has become popular with people of all ages in recent years — коли й серед кого.', 'Much colder than people expect — після порівняльного ступеня потрібне than.',
     'Плавати з іншими й спершу триматися біля берега — дві поради, з’єднані and.', 'Заходити повільно, даючи тілу звикнути до холоду.',
     'Після дощу річки бувають забруднені, тож варто перевіряти місцеві повідомлення. Варіант про повну заборону суперечить висновку тексту.',
     'Respect the water, and it will give you a great deal in return — порада з наслідком.'])
s += cloze(v, 'grammar', 'eng-tenses', 23, """An unusual journey

Last summer my cousin [23] across Ukraine by bike. She [24] the trip for months, so she knew exactly which roads to take. Every evening she [25] a short post about the day. On the tenth day her bike [26] in a village near Poltava, and a local mechanic fixed it for free. She says the trip was the best experience she [27] ever had.""", [
    (['cycled', 'has cycled', 'had cycled', 'cycles'], 'Last summer — завершена подія в минулому: Past Simple.'),
    (['had been planning', 'has planned', 'is planning', 'plans'], 'Планування тривало до поїздки, тобто до іншої минулої події: Past Perfect Continuous.'),
    (['wrote', 'writes', 'has written', 'had written'], 'Повторювана дія в минулій розповіді (every evening): Past Simple.'),
    (['broke down', 'broke up', 'broke out', 'broke into'], 'Break down — зламатися (про техніку). Break up — розійтися, break out — спалахнути, break into — вдертися.'),
    (['has', 'had', 'is', 'was'], 'Після she says часи не зсуваються: the best experience she has ever had — Present Perfect із ever.'),
])
s += cloze(v, 'vocab', 'eng-vocabulary', 28, """Online safety

Most of us spend several hours online every day, so it is important to [28] care of our personal information. Never [29] your password with anyone, even a close friend. Be careful about clicking on links in messages from people you do not [30]. If a website asks for more information than it really needs, it is better to [31] it altogether. And remember: once something is posted online, it can be very difficult to [32] it completely.""", [
    (['take', 'make', 'have', 'give'], 'Стале сполучення take care of — дбати про.'),
    (['share', 'tell', 'divide', 'split'], 'Share something with somebody — ділитися. Tell не поєднується з with у цьому значенні.'),
    (['know', 'meet', 'learn', 'realise'], 'People you do not know — незнайомі люди.'),
    (['avoid', 'prevent', 'refuse', 'escape'], 'Avoid a website altogether — зовсім не користуватися ним. Prevent — запобігти чомусь, escape — утекти.'),
    (['remove', 'clean', 'wash', 'empty'], 'Remove something from the internet — видалити.'),
])
sets.append(s)

# Shuffle options deterministically; questions sharing one option list keep a shared order and distinct keys.
groups = collections.defaultdict(list)
for x in questions:
    groups[x['groupId']].append(x)
for gid, qs in groups.items():
    shared = all(x['options'] == qs[0]['options'] for x in qs)
    for x in (qs[:1] if shared else qs):
        rng, order = random.Random(gid if shared else x['id']), list(range(len(x['options'])))
        targets = qs if shared else [x]
        while True:
            rng.shuffle(order)
            if not shared or len({order.index(t['answer']) for t in targets}) == len(targets):
                break
        opts = [x['options'][i] for i in order]
        for t in targets:
            t['answer'], t['options'] = order.index(t['answer']), opts
for st in sets:
    assert len(st) == 32 and len(set(st)) == 32, len(st)
out = os.path.join(ROOT, 'src', 'content', '31-eng-mocks-2.json')
json.dump({'topicQuestions': questions, 'mockSets': {'eng': sets}}, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(out, len(questions), 'keys', [x['answer'] for x in questions])
