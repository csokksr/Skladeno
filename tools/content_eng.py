"""English mock variants 4–5 in the NMT-2026 layout: 5 notices → headings, a long text with
5 questions, two gapped texts with 6 gaps and 8 options, two cloze texts with 5 gaps each.
Writes src/content/30-eng-mocks.json."""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
questions, sets = [], []


def add(vid, part, topic, fmt, prompt, passage, options, answer, explanation, level, group):
    qid = f'eng-v{vid}-{part}-{len([q for q in questions if q["id"].startswith(f"eng-v{vid}-{part}-")]) + 1}'
    questions.append({'id': qid, 'subject': 'eng', 'topicId': topic, 'type': 'single', 'format': fmt,
                      'prompt': prompt, 'passage': passage, 'options': options, 'answer': answer,
                      'explanation': explanation, 'level': level, 'tags': [fmt, 'reading' if fmt != 'gapfill' else 'use-of-english'],
                      'groupId': group})
    return qid


def headings(vid, options, notices):
    """notices: [(text, answer_index, explanation)]"""
    return [add(vid, 'notice', 'eng-matching', 'matching',
                'Оберіть заголовок, що найточніше відповідає оголошенню. Три варіанти в блоці зайві.',
                text, options, a, ex, 2, f'eng-v{vid}-notices') for text, a, ex in notices]


def reading(vid, text, items):
    return [add(vid, 'read', 'eng-reading', 'reading', prompt, text, opts, a, ex, 3, f'eng-v{vid}-text')
            for prompt, opts, a, ex in items]


def gapped(vid, part, topic, text, options, answers, explanations, level=3):
    return [add(vid, part, topic, 'gapfill', f'Choose the best option (A–H) for gap [{n}]. Two options are extra.',
                text, options, a, ex, level, f'eng-v{vid}-{part}')
            for n, a, ex in zip(range(gap_start(part, vid), gap_start(part, vid) + 6), answers, explanations)]


def gap_start(part, vid):
    return 11 if part == 'sent' else 17


def cloze(vid, part, topic, text, first, items):
    return [add(vid, part, topic, 'gapfill', f'Choose the correct option for gap [{first + i}].', text, opts, a, ex, 2,
                f'eng-v{vid}-{part}') for i, (opts, a, ex) in enumerate(items)]


# ---------------------------------------------------------------- Variant 4
v = 4
s = []
s += headings(v, ['The event has moved to a new date', 'Free entry for a limited group', 'A new club is looking for members',
                  'Equipment will be provided', 'Booking is essential', 'A service is temporarily unavailable',
                  'Lost property can be collected', 'A competition with a prize'], [
    ('Due to repairs to the roof, the school swimming pool will remain closed until 14 March. Swimming lessons for Year 9 will take place in the sports hall instead.',
     5, 'Басейн тимчасово зачинено на ремонт — послуга тимчасово недоступна.'),
    ("Spaces in Saturday's pottery workshop are limited to twelve. Please reserve your place at the front desk or online; unfortunately, we cannot accept people who simply turn up on the day.",
     4, 'Без попереднього запису не пускають: booking is essential.'),
    ("Found in the main hall after Friday's concert: two umbrellas, a blue scarf and a set of keys. Items can be picked up from the caretaker's office before 4 p.m.",
     6, 'Знайдені речі можна забрати в кабінеті завгоспа — lost property.'),
    ("Write a short story of no more than 800 words on the theme 'A door I never opened'. The winning entry will be published in the town magazine, and its author will receive a tablet.",
     7, 'Конкурс оповідань із призом-планшетом.'),
    ('The river clean-up planned for 2 May has been postponed because of the flood warning. It will now take place on 16 May at the same time and place.',
     0, 'Ключове слово postponed: подію перенесено на іншу дату. Волонтерів прямо не шукають.'),
])
text4 = """When Olena Marchuk retired from teaching, she expected to spend her mornings in the garden. Instead, she spends three days a week behind the wheel of an old delivery van that she and her neighbours have turned into a library.

The idea came from a conversation at the village shop. A grandmother complained that her grandchildren had stopped reading because the nearest library was forty kilometres away and the bus ran only twice a day. 'Everyone agreed it was a pity,' Olena remembers, 'but nobody thought it was their job to do something about it. I realised that if I waited for someone else, I would be waiting for ever.'

The van cost less than a second-hand car, but turning it into a library took most of a year. A local carpenter built the shelves for free, and a group of teenagers painted the outside with characters from children's books. The books themselves came from donations. 'At first we accepted everything,' Olena admits, 'and ended up with boxes of old phone directories and cookery magazines. Now we are much more selective.'

Today the van visits eleven villages on a fixed timetable. Children borrow most of the books, but the most loyal visitors are elderly people who live alone. For some of them, the fifteen minutes they spend choosing a novel and chatting is the only conversation they have all week. 'I used to think we were delivering books,' Olena says. 'Now I think we are delivering company.'

Not everything has gone smoothly. In winter the roads are sometimes too icy to drive, and last year the van broke down twice, leaving readers waiting in the cold. The project also depends entirely on volunteers, and two of the original drivers have moved to the city. Olena is now training a group of sixth-formers, who will be able to help once they pass their driving tests.

Asked what advice she would give to anyone starting a similar project, Olena does not hesitate. 'Don't spend months planning. Start small, make mistakes in public and let people help you fix them. A project that belongs to everyone is much harder to stop.'"""
s += reading(v, text4, [
    ('What made Olena start the project?', ['She was bored after she retired.', 'A neighbour asked her to run the village library.',
     'She saw that nobody else was going to act on a shared concern.', 'The bus service to the town was cancelled.'], 2,
     'У другому абзаці: nobody thought it was their job… if I waited for someone else, I would be waiting for ever. Автобус не скасували — він ходить двічі на день.'),
    ('What does Olena say about the first donations?', ['Many of them were not useful.', 'They were mostly children\'s books.',
     'They arrived too late.', 'They had to be paid for.'], 0,
     'Спочатку брали все й отримали старі телефонні довідники та журнали — тобто багато непотрібного.'),
    ('According to the text, the van is especially important for', ['the teenagers who painted it.', 'older people who live on their own.',
     'teachers in nearby schools.', 'families who have moved to the city.'], 1,
     'The most loyal visitors are elderly people who live alone… the only conversation they have all week.'),
    ('What is the main problem the project faces now?', ['The van is too expensive to repair.', 'Readers lose interest in winter.',
     'There are not enough people to drive the van.', 'The timetable changes every week.'], 2,
     'Two of the original drivers have moved to the city, тому Олена навчає старшокласників. Про вартість ремонту в тексті не сказано.'),
    ("Olena's main advice is to", ['plan every detail before starting.', 'begin with something small and involve other people.',
     'avoid making mistakes in public.', 'ask the local council for money.'], 1,
     'Start small… let people help you fix them. Ретельне планування й уникання публічних помилок прямо суперечать її словам.'),
])
s += gapped(v, 'sent', 'eng-cohesion', """Most parents have had the experience of trying to wake a teenager who seems to be glued to the bed. It is easy to blame laziness, but scientists say the problem is mostly biological. [11] As a result, a fifteen-year-old who goes to bed at ten often simply lies awake.

This shift would not matter much if school began later. [12] Many students therefore arrive at their first lesson having slept only six or seven hours, although experts recommend between eight and ten.

The effects of losing sleep go far beyond yawning in class. [13] Tired students also find it harder to control their emotions, and they are more likely to have accidents on the way to school.

Some schools have decided to act on this research. [14] Teachers there reported that students were more alert, and attendance at the first lesson improved noticeably.

Of course, a later start is not a complete solution. [15] Screens are a particular problem, because the light from phones and laptops tells the brain that it is still daytime.

Specialists suggest a few simple habits. [16] Keeping the same bedtime at the weekend also helps, even if the temptation to sleep until lunchtime is strong.""",
    ['During adolescence, the body starts producing the sleep hormone melatonin about two hours later than in childhood.',
     'However, in most countries lessons start at around eight o\'clock.',
     'Research shows that memory and concentration suffer first, so information learned during the day is not stored properly.',
     'In one American district, classes were moved from 7:30 to 8:30.',
     'Teenagers may still be short of sleep because of what they do in the evening.',
     'Putting devices in another room an hour before bed is one of the most effective.',
     'Most adults need much less sleep than they did as children.',
     'Some students prefer to study late at night when the house is quiet.'],
    [0, 1, 2, 3, 4, 5],
    ['Після слів «проблема біологічна» потрібне пояснення механізму (мелатонін), а As a result наступного речення — його наслідок.',
     'This shift would not matter much if school began later → However: уроки починаються о восьмій.',
     'Абзац про наслідки недосипу: спершу пам’ять і концентрація, далі also — емоції та нещасні випадки.',
     'Some schools have decided to act → конкретний приклад; teachers there відсилає до цього округу.',
     'A later start is not a complete solution → причина у вечірніх звичках; далі уточнення про екрани.',
     'A few simple habits → перша звичка (one of the most effective), далі also helps — друга.'])
s += gapped(v, 'phrase', 'eng-cohesion', """Ten years ago, the centre of Pontevedra, a small city in north-west Spain, was [17]. Today, children play football in squares that used to be car parks, and the only sound in the main street is conversation.

The change began when a new mayor decided that public space should belong to people [18]. Instead of building more roads, the city closed the centre to private traffic, [19]. Delivery vans are allowed in for a few hours each morning, and residents can still reach their garages.

Many shop owners were furious at first, [20]. In fact, the opposite happened: the number of people walking through the centre grew, and most shops reported higher sales.

The policy has also had a surprising effect on the population. While many similar towns in the region have been losing residents, Pontevedra has grown, [21].

Other cities have studied the example, but the mayor warns that copying it is not simple. 'You cannot just put up a sign,' he says. 'Change works only [22].'""",
    ['full of traffic jams and noisy with engines', 'rather than to vehicles', 'keeping it open only for emergency vehicles and deliveries',
     'because they believed customers would stop coming', 'partly because young families want to live somewhere safe and quiet',
     'when people can see the benefits in their own daily lives', 'which forced most residents to sell their cars',
     'although the mayor had never visited another country'],
    [0, 1, 2, 3, 4, 5],
    ['Контраст Ten years ago … Today: тоді — затори й шум, тепер — тиша.', 'Should belong to people rather than to vehicles — протиставлення.',
     'Закрили для приватного транспорту, лишивши доступ екстреним службам і доставці; далі про фургони доставки. Варіант про примусовий продаж авто суперечить тому, що мешканці доїжджають до гаражів.',
     'Furious … because they believed customers would stop coming; In fact, the opposite happened.',
     'Місто зросло — пояснення причини (молоді родини).', 'Change works only when … — умова, за якої зміни працюють.'])
s += cloze(v, 'grammar', 'eng-tenses', """My first job

When I was sixteen, I [23] a summer job at a café near the beach. I had never worked before, so I was nervous on my first day. The manager, a tall woman [24] name was Irena, showed me how to use the coffee machine and told me that I [25] to wear a uniform. By the end of the first week I [26] more than two hundred cups of coffee! It was hard work, but I learned that being polite to customers is [27] important than being fast.""", 23, [
    (['got', 'have got', 'was getting', 'get'], 0, 'Завершена дія в минулому (When I was sixteen) — Past Simple got.'),
    (['who', 'whose', 'which', 'that'], 1, 'Ім’я належить жінці: a woman whose name was Irena.'),
    (['had', 'must', 'should', 'would'], 0, 'Після пропуску стоїть to: had to wear. Must/should/would не поєднуються з to.'),
    (['made', 'had made', 'have made', 'was making'], 1, 'By the end of the first week — дія завершилася до моменту в минулому: Past Perfect.'),
    (['more', 'most', 'much', 'the more'], 0, 'Порівняння двох речей з than: more important than.'),
])
s += cloze(v, 'vocab', 'eng-vocabulary', """Learning a language online

Thousands of people now [28] advantage of free apps to learn foreign languages. These programs are popular because users can study whenever they like and [29] their own progress. However, teachers point out that apps cannot completely [30] a real conversation. To become fluent, learners need to stop worrying about [31] mistakes, listen to native speakers and practise speaking regularly. The best results usually come when online tools are combined [32] lessons with a teacher.""", 28, [
    (['take', 'make', 'have', 'get'], 0, 'Стале сполучення take advantage of.'),
    (['track', 'lead', 'pass', 'spend'], 0, 'Track progress — стежити за прогресом.'),
    (['replace', 'exchange', 'change', 'remove'], 0, 'Застосунки не можуть повністю замінити (replace) розмову.'),
    (['doing', 'making', 'taking', 'having'], 1, 'Make mistakes; після about — герундій making.'),
    (['with', 'to', 'by', 'from'], 0, 'Combine something with something.'),
])
sets.append(s)

# ---------------------------------------------------------------- Variant 5
v = 5
s = []
s += headings(v, ['Help for people with no internet access', 'A change in opening hours', 'Bring something to exchange',
                  'Not suitable for young children', 'Places are still available', 'Payment is now online only',
                  'An activity for the whole family', 'A request for quiet'], [
    ('From Monday, the town museum will open at 11 a.m. instead of 9 a.m. on weekdays, but it will now stay open until 7 p.m.',
     1, 'Змінено години роботи музею.'),
    ('Clothes swap at the youth centre! Leave one item you no longer wear and take home something new to you. No money changes hands.',
     2, 'Обмін одягом: принеси річ, візьми іншу.'),
    ('Our next escape-room game contains loud sound effects, flashing lights and scenes of crime. We do not admit players under 14.',
     3, 'Гравців до 14 років не допускають.'),
    ('Exam season has started. Students revising in the reading room are asked to switch phones to silent and to take conversations into the corridor.',
     7, 'Прохання не шуміти в читальній залі.'),
    ('Not sure how to fill in an application on a government website? Every Thursday our librarians help visitors who do not have a computer at home to complete online forms.',
     0, 'Допомога тим, у кого вдома немає комп’ютера й інтернету.'),
])
text5 = """At fourteen, Daria Kovalenko could not understand why her grandmother refused to drink water from the well in her village. 'She told me it made people ill after heavy rain,' Daria says. 'I thought she was being old-fashioned. Then I tested a sample in the school laboratory and found she was right.'

That discovery became the starting point of a three-year project. Daria knew that proper filters existed, but they were too expensive for most families in the village, and they needed replacement parts that could only be ordered from the city. She set herself a simple goal: a filter that cost less than a pair of trainers and could be repaired with materials sold in any village shop.

Her first designs were failures. One clogged after two days; another worked perfectly but was so heavy that nobody could lift it. 'I kept a notebook of everything that went wrong,' she explains. 'Looking back, that notebook taught me more than the experiments that worked.' Her chemistry teacher allowed her to use the laboratory after lessons, but he refused to give her the answers. 'He only asked questions,' Daria laughs. 'It drove me mad at the time.'

The final version uses layers of sand, gravel and charcoal from burnt wood inside an ordinary plastic bucket. Independent tests carried out by a university showed that it removes most harmful bacteria, although the scientists stressed that the water should still be boiled after heavy flooding.

Last spring the filter won a national science competition, and several families in Daria's village now use it. She has decided not to patent the design. Instead, she has published step-by-step instructions online so that anyone can build one. 'If I sold it, I could make some money,' she says. 'But the people who need it most would be the last to get it.'

Daria now plans to study environmental engineering. Her grandmother, she adds, still prefers to boil her water — just in case."""
s += reading(v, text5, [
    ('Why did Daria first test the well water?', ['Her teacher asked her to.', 'She doubted what her grandmother had told her.',
     'Many villagers had fallen ill.', 'She needed a topic for a competition.'], 1,
     'I thought she was being old-fashioned. Then I tested a sample — вона сумнівалася в словах бабусі.'),
    ("What was Daria's main aim when designing the filter?", ['To make it more effective than filters sold in shops.',
     'To keep it cheap and easy to repair locally.', 'To sell it to families in the city.', 'To make it light enough for children to carry.'], 1,
     'A filter that cost less than a pair of trainers and could be repaired with materials sold in any village shop.'),
    ('What does Daria say about her failed designs?', ['She was embarrassed by them.', 'They were caused by poor materials.',
     'Recording them taught her a lot.', 'Her teacher helped her to avoid them.'], 2,
     'That notebook taught me more than the experiments that worked.'),
    ('What did the university tests show?', ['The filter makes boiling unnecessary.', 'The filter removes most harmful bacteria.',
     'The filter works only after floods.', 'The filter needs expensive parts.'], 1,
     'It removes most harmful bacteria; після повені воду все одно треба кип’ятити, тож твердження, що кип’ятити не потрібно, хибне.'),
    ('Why has Daria not patented the filter?', ['She wants it to reach the people who need it.', 'The competition rules did not allow it.',
     'Her teacher advised her against it.', 'The design is not original.'], 0,
     'The people who need it most would be the last to get it.'),
])
s += gapped(v, 'sent', 'eng-cohesion', """A day in the mountains can be one of the most rewarding experiences of the summer, but it can also go wrong surprisingly quickly. Good preparation starts long before you put on your boots.

First, choose a route that matches your fitness. [11] If you have never walked more than ten kilometres, a twenty-kilometre trail with steep climbs is not the place to start.

Next, check the weather forecast on the evening before and again in the morning. [12] Thunderstorms, in particular, can develop within an hour, and an exposed ridge is the worst place to be when lightning strikes.

Your rucksack does not need to be heavy, but some items are essential. [13] Many walkers also forget that a phone battery drains quickly in the cold, so a small power bank is worth carrying.

Always tell someone where you are going and when you expect to return. [14] It sounds old-fashioned, but in remote areas there is often no mobile signal at all.

Finally, be prepared to change your plans. [15] Experienced mountaineers say that the summit will still be there next year, but you might not be if you take unnecessary risks.

After the hike, take a few minutes to note what went well and what did not. [16]""",
    ['Look carefully at both the distance and the total height you will have to climb.',
     'Conditions in the mountains change much faster than in the valley.',
     'Water, a warm layer, a map and some high-energy food should always go in first.',
     'That way, they can raise the alarm if you do not come back on time.',
     'Turning back when the weather gets worse is a sign of good judgement, not weakness.',
     'Those notes will make your next trip safer and more enjoyable.',
     'Most mountain paths are closed during the summer season.',
     'Wearing new boots for the first time on a long walk is a common mistake.'],
    [0, 1, 2, 3, 4, 5],
    ['Вибір маршруту за силами: відстань і набір висоти; далі приклад про 20 км із крутими підйомами.',
     'Перевір прогноз → у горах погода змінюється швидше; далі in particular — грози.',
     'Some items are essential → перелік речей; далі also — повербанк.',
     'Tell someone… → That way, they can raise the alarm.', 'Be prepared to change your plans → повернутися — це розважливо.',
     'Note what went well → those notes допоможуть наступного разу.'])
s += gapped(v, 'phrase', 'eng-cohesion', """Most of us were taught as children not to talk to strangers, and many adults still follow this rule [17]. Yet a growing body of research suggests that short conversations with people we do not know can make us happier.

In one well-known experiment, commuters on a train were asked either to sit in silence or to start a conversation with the person next to them. Before the journey, most predicted that talking would be awkward [18]. In reality, those who chatted reported a more pleasant journey, and almost nobody was rejected.

Why do we expect the worst? Psychologists believe we underestimate how much other people want to connect, [19]. Each side waits for the other to begin, so nobody does.

The benefits are not limited to mood. Brief exchanges with a shop assistant or a neighbour can give people a sense of belonging, [20].

Of course, there are situations where caution is wise, [21]. But in a queue, at a bus stop or in a waiting room, a friendly comment about the weather costs nothing.

If you find the idea uncomfortable, start small. A smile or a simple 'thank you' [22].""",
    ['without ever asking whether it makes sense', 'and that the other person would not enjoy it',
     'and the people around us make the same mistake about us', 'which is especially important for those who live alone',
     'and nobody should feel forced to speak to anyone', 'is often enough to open the door to a longer chat',
     'because trains are usually too crowded to sit together', 'so most passengers refused to take part in the study'],
    [0, 1, 2, 3, 4, 5],
    ['Дорослі досі дотримуються правила, не замислюючись, чи воно має сенс; далі Yet — протиставлення.',
     'Прогноз учасників: незручно й неприємно співрозмовнику; In reality — навпаки. Варіант про відмову пасажирів суперечить тексту.',
     'Обидві сторони недооцінюють бажання спілкуватися: Each side waits for the other.',
     'Відчуття приналежності особливо важливе для самотніх людей.', 'Обережність доречна, і ніхто не мусить говорити силоміць.',
     'Start small: усмішки або «дякую» часто досить, щоб почати розмову.'])
s += cloze(v, 'grammar', 'eng-tenses', """A trip to remember

Last year our class [23] to Lviv for three days. We left very early in the morning because the train [24] at 5:40. Although we were tired, everybody was excited. If I [25] that the old town was so beautiful, I would have taken a better camera. Our guide, [26] had lived in the city all her life, told us stories about every building we passed. I hope we [27] there again next year.""", 23, [
    (['went', 'has gone', 'goes', 'had been going'], 0, 'Last year — завершена подія в минулому: Past Simple.'),
    (['left', 'has left', 'leaves', 'had been leaving'], 0, 'Розповідь у минулому, разова дія за розкладом того дня: left.'),
    (['had known', 'knew', 'know', 'would know'], 0, 'Третій тип умовних речень: If I had known…, I would have taken.'),
    (['who', 'which', 'whose', 'whom'], 0, 'Відокремлене означальне речення про людину в ролі підмета: who.'),
    (['will go', 'went', 'have gone', 'would have gone'], 0, 'Next year — майбутнє: I hope we will go.'),
])
s += cloze(v, 'vocab', 'eng-vocabulary', """Volunteering abroad

More and more young people decide to spend a gap year volunteering in another country. Supporters say it helps them [28] confidence and learn to cope with unfamiliar situations. Critics, however, argue that some programmes are more interested in [29] money than in helping local communities. Before signing up, it is worth doing some research and asking former volunteers about their [30]. A good organisation will explain exactly what your work will [31] and how it benefits the people you are going to help. Above all, remember that you are a guest, so try to [32] local customs.""", 28, [
    (['build', 'make', 'rise', 'grow up'], 0, 'Build confidence — набувати впевненості.'),
    (['making', 'doing', 'taking', 'winning'], 0, 'Make money; після in — герундій making.'),
    (['experiences', 'experiments', 'experts', 'exercises'], 0, 'Розпитати колишніх волонтерів про їхній досвід — experiences.'),
    (['involve', 'include in', 'consist', 'contain'], 0, 'What your work will involve — з чого складатиметься робота.'),
    (['respect', 'regard to', 'attend', 'admire to'], 0, 'Respect local customs — поважати місцеві звичаї.'),
])
sets.append(s)

for st in sets:
    assert len(st) == 32 and len(set(st)) == 32, len(st)

# Shuffle options deterministically so keys do not follow the authoring order;
# questions sharing one option list (headings, gapped texts) keep a shared order.
import random, collections
groups = collections.defaultdict(list)
for q in questions:
    groups[q['groupId']].append(q)
for gid, qs in groups.items():
    shared = all(q['options'] == qs[0]['options'] for q in qs)
    for q in (qs[:1] if shared else qs):
        rng = random.Random(q['id'] if not shared else gid)
        order = list(range(len(q['options'])))
        while True:
            rng.shuffle(order)
            if not shared or len({order.index(x['answer']) for x in qs}) == len(qs):
                break
        targets = qs if shared else [q]
        new_opts = [q['options'][i] for i in order]
        for x in targets:
            x['answer'] = order.index(x['answer'])
            x['options'] = new_opts
print('keys', [q['answer'] for q in questions])
out = os.path.join(ROOT, 'src', 'content', '30-eng-mocks.json')
json.dump({'topicQuestions': questions, 'mockSets': {'eng': sets}}, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(out, len(questions))
