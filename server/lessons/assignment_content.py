from typing import Optional


SUPPORTED_ASSIGNMENT_TYPES = {
    "quiz",
    "sorting",
    "matching",
    "poll",
    "slides",
    "grouping",
    "flashcards",
    "crossword",
    "other",
}


def normalize_assignment_type(raw_type: Optional[str], template_type: Optional[str] = None) -> str:
    assignment_type = (raw_type or "other").strip().lower()
    template_kind = (template_type or "").strip().lower()

    if assignment_type == "other" and template_kind in SUPPORTED_ASSIGNMENT_TYPES:
        return template_kind
    if assignment_type in SUPPORTED_ASSIGNMENT_TYPES:
        return assignment_type
    if template_kind in SUPPORTED_ASSIGNMENT_TYPES:
        return template_kind
    return "other"


def build_assignment_description(
    assignment_type: str,
    lesson_title: str = "",
    lesson_topic: str = "",
) -> str:
    topic = (lesson_topic or "").strip() or (lesson_title or "").strip() or "Дерекқор негіздері"
    t = normalize_assignment_type(assignment_type)

    templates = {
        "quiz": (
            f"Тақырып: {topic}\n"
            "Міндет:\n"
            "1. Викторинаны толық орындаңыз.\n"
            "2. Әр сұраққа бір дұрыс жауап таңдаңыз.\n"
            "3. Соңында нәтижені жіберіңіз.\n"
            "Бағалау: 80%+ жоғары, 60-79% орта, 60%-дан төмен болса тақырыпты қайталаңыз."
        ),
        "matching": (
            f"Тақырып: {topic}\n"
            "Міндет:\n"
            "1. SQL командаларын олардың қызметімен сәйкестендіріңіз.\n"
            "2. Барлық жұптарды толық жинақтаңыз.\n"
            "3. Нәтижені тексеріп, жіберіңіз."
        ),
        "sorting": (
            f"Тақырып: {topic}\n"
            "Міндет:\n"
            "1. SQL сұранысын орындау қадамдарын дұрыс ретке келтіріңіз.\n"
            "2. Логикалық реттілік сақталғанын тексеріңіз.\n"
            "3. Тапсырманы жіберіңіз."
        ),
        "poll": (
            f"Тақырып: {topic}\n"
            "Міндет:\n"
            "1. Сауалнама сұрағына өз таңдауыңызды беріңіз.\n"
            "2. Жауап таңдауыңызды қысқаша дәлелдеңіз (ауызша/жазбаша талқылауға дайын болыңыз).\n"
            "3. Нәтижені сынып статистикасымен салыстырыңыз."
        ),
        "slides": (
            f"Тақырып: {topic}\n"
            "Міндет:\n"
            "1. Берілген слайд материалын қарап шығыңыз.\n"
            "2. Негізгі ұғымдарды (Primary Key, Foreign Key, JOIN) қысқаша конспект жазыңыз.\n"
            "3. Бір мысал SQL сұранысын құрастырып, жауап ретінде жіберіңіз."
        ),
        "grouping": (
            f"Тақырып: {topic}\n"
            "Міндет:\n"
            "1. Берілген ұғымдарды тиісті топтарға бөліңіз.\n"
            "2. Әр элемент өз тобына дұрыс түскенін тексеріңіз.\n"
            "3. Дайын болған соң нәтижені жіберіңіз."
        ),
        "flashcards": (
            f"Тақырып: {topic}\n"
            "Міндет:\n"
            "1. Флешкарттардағы терминдерді қайталаңыз.\n"
            "2. Әр терминге қысқа анықтама айтыңыз немесе жазыңыз.\n"
            "3. Соңында өзін-өзі тексеріп, тапсырманы аяқтаңыз."
        ),
        "crossword": (
            f"Тақырып: {topic}\n"
            "Міндет:\n"
            "1. Кроссвордтағы ұяшықтарды дерекқор терминдерімен толтырыңыз.\n"
            "2. Әр сөздің орфографиясын тексеріңіз.\n"
            "3. Толық аяқталғаннан кейін нәтижені жіберіңіз."
        ),
        "other": (
            f"Тақырып: {topic}\n"
            "Міндет:\n"
            "1. Тақырып бойынша кемі 3 негізгі ұғымды түсіндіріңіз.\n"
            "2. Бір нақты мысал келтіріңіз (кесте/сұраныс/байланыс).\n"
            "3. Жауапты мәтін немесе файл түрінде жіберіңіз."
        ),
    }

    return templates.get(t, templates["other"])
