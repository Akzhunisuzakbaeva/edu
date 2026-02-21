from django.db import models

class Quiz(models.Model):
    title = models.CharField(max_length=200)

    def __str__(self) -> str:
        return self.title

class Question(models.Model):
    quiz = models.ForeignKey(Quiz, related_name="questions", on_delete=models.CASCADE)
    text = models.CharField(max_length=500)
    order = models.PositiveIntegerField(default=0)

    def __str__(self) -> str:
        return self.text

class Answer(models.Model):
    # МАҢЫЗДЫ: "Question" атауы ТЫРНАҚША ішінде болуы керек!
    question = models.ForeignKey("Question", related_name="answers", on_delete=models.CASCADE)
    text = models.CharField(max_length=255)
    is_correct = models.BooleanField(default=False)

    def __str__(self) -> str:
        return f"{self.text} ({'Correct' if self.is_correct else 'Wrong'})"
