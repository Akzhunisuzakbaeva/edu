from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

from slide.models import SlideTemplate


User = get_user_model()


TEMPLATES = [
    # Математика (7-9)
    {
        "title": "Функция түрлері (Quiz)",
        "template_type": "quiz",
        "data": {
            "question": "y = ax² + bx + c графигі қандай?",
            "options": ["Түзу", "Парабола", "Шеңбер", "Гипербола"],
            "answer": "Парабола",
        },
    },
    {
        "title": "Формула ↔ атау (Matching)",
        "template_type": "matching",
        "data": {
            "left": ["a² - b²", "(a+b)²", "D", "y = kx + b"],
            "right": ["(a-b)(a+b)", "a² + 2ab + b²", "b² - 4ac", "Түзу сызық теңдеуі"],
        },
    },
    {
        "title": "Амалдар реті (Sorting)",
        "template_type": "sorting",
        "data": {
            "items": [
                "1) Жақша",
                "2) Дәреже",
                "3) Көбейту/бөлу",
                "4) Қосу/азайту",
            ]
        },
    },
    {
        "title": "Үлкен/кіші/тең (Grouping)",
        "template_type": "grouping",
        "data": {
            "groups": [
                {"title": "Үлкен (>)", "items": ["5 ? 3", "9 ? 2"]},
                {"title": "Кіші (<)", "items": ["2 ? 7", "1 ? 4"]},
                {"title": "Тең (=)", "items": ["6 ? 6", "10 ? 10"]},
            ]
        },
    },
    {
        "title": "Қай тәсіл тиімді? (Poll)",
        "template_type": "poll",
        "data": {
            "question": "Теңдеу шешуде қай тәсілді жиі қолданасың?",
            "options": ["Формула", "График", "Кесте", "Теңестіру"],
        },
    },

    # Информатика (7-9)
    {
        "title": "Алгоритм ұғымы (Quiz)",
        "template_type": "quiz",
        "data": {
            "question": "Алгоритм дегеніміз не?",
            "options": [
                "Қадам-қадаммен орындалатын нұсқаулық",
                "Кездейсоқ әрекеттер жиыны",
                "Тек бір рет орындалатын команда",
                "Компьютер құрылғысы",
            ],
            "answer": "Қадам-қадаммен орындалатын нұсқаулық",
        },
    },
    {
        "title": "Дерек түрлері (Matching)",
        "template_type": "matching",
        "data": {
            "left": ["int", "float", "string", "bool"],
            "right": ["Бүтін сан", "Нақты сан", "Жол", "Логикалық"],
        },
    },
    {
        "title": "Компьютер бөліктері (Grouping)",
        "template_type": "grouping",
        "data": {
            "groups": [
                {"title": "Құрылғылар", "items": ["Монитор", "Пернетақта", "Тышқан"]},
                {"title": "Бағдарламалар", "items": ["Браузер", "Редактор", "ОЖ"]},
            ]
        },
    },
    {
        "title": "Қауіпсіздік ережелері (Sorting)",
        "template_type": "sorting",
        "data": {
            "items": [
                "1) Күмәнді сілтемені ашпау",
                "2) Құпиясөзді бөліспеу",
                "3) Антивирус жаңарту",
                "4) Қоғамдық Wi‑Fi‑ды сақ қолдану",
            ]
        },
    },
    {
        "title": "Тақырыпты таңдау (Poll)",
        "template_type": "poll",
        "data": {
            "question": "Қай тақырып қызық?",
            "options": ["Кодтау", "Роботика", "Киберқауіпсіздік", "Деректер"],
        },
    },
]


class Command(BaseCommand):
    help = "Seed math/informatics templates for a teacher user."

    def add_arguments(self, parser):
        parser.add_argument(
            "--username",
            type=str,
            default="teacher",
            help="Teacher username to own templates.",
        )

    def handle(self, *args, **options):
        username = options["username"]
        user = User.objects.filter(username=username).first()
        if not user:
            self.stdout.write(self.style.ERROR(f"User '{username}' not found"))
            return

        created = 0
        for t in TEMPLATES:
            obj, is_new = SlideTemplate.objects.get_or_create(
                author=user,
                title=t["title"],
                defaults={
                    "template_type": t["template_type"],
                    "data": t["data"],
                },
            )
            if is_new:
                created += 1

        self.stdout.write(self.style.SUCCESS(f"Seeded templates: {created}"))
