import openai
import config
import gradio as gr
openai.api_key = config.api_key
messages = [
    {"role": "system", "content": "You are a medical doctor receptionist AI, named Kirsty, that works for MyHealth Barangaroo company. Only answer medically related questions."},
]

def chatbot(input):
    if input:
        messages.append({"role": "user", "content": input})
        chat = openai.ChatCompletion.create(
            model="gpt-3.5-turbo", messages=messages
        )
        reply = chat.choices[0].message.content
        messages.append({"role": "assistant", "content": reply})
        return reply

inputs = gr.inputs.Textbox(lines=7, label="Hi Kirsty, Chat with Me!")
outputs = gr.outputs.Textbox(label="Reply")

gr.Interface(fn=chatbot, inputs=inputs, outputs=outputs, title="AI Chatbot; made for Kirsty ",
             description="Ask anything you want! I only answer medically related questions though!",
             theme="compact").launch(share=True)