from models import BancoDeQuestoes, Question
from docx import Document


def read_docx(filename):
    response = []
    doc = Document(filename + ".docx")

    for p in doc.paragraphs:
        response.append(p.text.strip())

    return response

def text_parse(doc):
    
    header = ""
    paragraph = ""
    while paragraph != "#Questão":
        header += paragraph + "\n"
        paragraph = doc.pop(0) 

    response_BQ = BancoDeQuestoes(header)

    buffer = []
    while doc:
        paragraph = doc.pop(0)
        if paragraph != "#Questão" and paragraph != "#Final":
            buffer.append(paragraph)
            
        else:
            question = Question(buffer)
            response_BQ.question_list.append(question)
            buffer = []

    return response_BQ


if __name__ == "__main__":
    filename = 'docs\Prática de Ensino da Língua Francesa I\BQ II- Prática de Ensino da Língua Francesa I'
    
    doc = read_docx(filename)
    response_BQ = text_parse(doc)
    
    response_BQ.to_xml(filename)
    #print(response_BQ.header)
    #for q in response_BQ.question_list:
    #    print(q)