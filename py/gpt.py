import openai
import os
import config
from django.shortcuts import render
from django.http import JsonResponse

openai.api_key = config.api_key

def chatbot(request):
    if request.method == 'POST':
        # Get user input
        user_input = request.POST['user_input']

        # Call the ChatGPT API to get a response
        response = openai.Completion.create(
            engine='davinci',
            prompt=f"Conversation with a user:\nUser: {user_input}\nAI:",

            max_tokens=256,
            n=1,
            stop=None,
            temperature=0.7,
        )

        # Extract the response text from the API result
        bot_response = response.choices[0].text.strip()

        # Return the response as JSON
        return JsonResponse({'bot_response': bot_response})

    # If the request is not a POST, render the chatbot template
    return render(request, 'chatbot.html')




# import os
# import openai
#
# openai.api_key = os.getenv("OPENAI_API_KEY")
#
# response = openai.Completion.create(
#   model="code-davinci-002",
#   prompt="\"\"\"\n1. Create a list of first names\n2. Create a list of last names\n3. Combine them randomly into a list of 100 full names\n\"\"\"\n\nimport random\n\nfirst_names = ['John', 'Jane', 'Corey', 'Travis', 'Dave', 'Kurt', 'Neil', 'Sam', 'Steve', 'Tom', 'James', 'Robert', 'Michael', 'Charles', 'Joe', 'Mary', 'Maggie', 'Nicole', 'Patricia', 'Linda', 'Barbara', 'Elizabeth', 'Laura', 'Jennifer', 'Maria']\n\nlast",
#   temperature=0,
#   max_tokens=300,
#   top_p=1,
#   frequency_penalty=0,
#   presence_penalty=0
# )