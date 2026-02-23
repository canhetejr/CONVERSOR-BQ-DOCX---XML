import xml.etree.ElementTree as ET
from xml.dom import minidom

# TODO: adicionar suporte para Imagens
class Question:
    def __init__(self, text):
        self.question = ""
        self.correct_answer = ""
        self.wrong_answer_list = []
        self.justification = ""

        t = text.pop(0)
        while t != "#Resposta":
            self.question += t + "\n"
            t = text.pop(0)

        t = text.pop(0)
        while t !="#Resposta":
            self.correct_answer += t + "\n"
            t = text.pop(0)


        # TODO: Tirar esse break que ta feio :)
        buffer = ""
        while text:
            t = text.pop(0)
            if t == "#Resposta":
                self.wrong_answer_list.append(buffer)
                buffer = ""
            elif t == "#Justificativa":
                self.wrong_answer_list.append(buffer)
                break
            else:
                buffer += t

        while text:
            t = text.pop(0)
            self.justification += t


    def __str__(self):
        response = f"{self.question}\n"
        response += f"Resposta Correta:\n{self.correct_answer}"
        for wrong_answer in self.wrong_answer_list:
            response += f"Resposta:\n{wrong_answer}\n"
        response += f"Justificativa:\n{self.justification}"
        
        return response

class BancoDeQuestoes:
    def __init__(self, header):
        self.header = header
        self.question_list = []

    def to_xml(self, filename):
        root = ET.Element('quiz')
        for n,q in enumerate(self.question_list):
            question = ET.SubElement(root, "question", attrib={"type": "multichoice"})

            name = ET.SubElement(question, "name")
            ET.SubElement(name, "text").text = f"<![CDATA[Questão {n+1}]]>"

            questiontext = ET.SubElement(question, "questiontext", attrib={"format":"moodle_auto_format"})
            ET.SubElement(questiontext, "text").text = f"<![CDATA[{q.question}]]>"

            generalfeedback = ET.SubElement(question, "generalfeedback", attrib={"format":"moodle_auto_format"})
            ET.SubElement(generalfeedback, "text").text = "<![CDATA[]]>"


            ET.SubElement(question, 'defaultgrade').text = "1.0000000"
            ET.SubElement(question, 'penalty').text = "0.3333333"
            ET.SubElement(question, 'hidden').text = "0"
            ET.SubElement(question, 'idnumber').text = ""
            ET.SubElement(question, 'single').text = "true"
            ET.SubElement(question, 'shuffleanswers').text = "true"
            ET.SubElement(question, 'answernumbering').text = "abc"
            # ET.SubElement(question, 'showstandardinstruction').text = "1"   
            
            correctfeedback = ET.SubElement(question, 'correctfeedback', {'format': 'moodle_auto_format'})
            ET.SubElement(correctfeedback, "text").text = "Sua resposta está correta."
            partiallycorrectfeedback = ET.SubElement(question, 'partiallycorrectfeedback', {'format': 'moodle_auto_format'})
            ET.SubElement(partiallycorrectfeedback, "text").text = "Sua resposta está parcialmente correta."
            incorrectfeedback = ET.SubElement(question, 'incorrectfeedback', {'format': 'moodle_auto_format'})
            ET.SubElement(incorrectfeedback, "text").text = "Sua resposta está incorreta."
            ET.SubElement(question, 'shownumcorrect')

            answer = ET.SubElement(question, "answer", attrib={"fraction":"100", "format":"moodle_auto_format"})
            ET.SubElement(answer, "text").text = f"<![CDATA[{q.correct_answer}]]>"
            feedback = ET.SubElement(answer, "feedback", attrib={"format":"moodle_auto_format"})
            ET.SubElement(feedback, "text").text = "<![CDATA[]]>"

            for a in q.wrong_answer_list:
                answer = ET.SubElement(question, "answer", attrib={"fraction":"0", "format":"moodle_auto_format"})
                ET.SubElement(answer, "text").text = f"<![CDATA[{a}]]>"
                feedback = ET.SubElement(answer, "feedback", attrib={"format":"moodle_auto_format"})
                ET.SubElement(feedback, "text").text = "<![CDATA[]]>"

            # Convert to string
            xml_str = ET.tostring(root, encoding='utf-8')

            # Pretty print
            pretty_xml = minidom.parseString(xml_str).toprettyxml(indent="  ")

            # Replace escaped CDATA
            pretty_xml = pretty_xml.replace('&lt;![CDATA[', '<![CDATA[').replace(']]&gt;', ']]>')

            # Write to file
            with open(f"{filename}.xml", "w", encoding="utf-8") as file:
                file.write(pretty_xml)