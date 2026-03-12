import os
from flask import Flask, render_template, request, jsonify
from google import genai
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

# Initialize the Gemini Client
# Make sure your .env file has: GEMINI_API_KEY=your_actual_key_here
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/chat", methods=["POST"])
def chat():
    try:
        data = request.json
        user_message = data.get("message")
        
        # This sends the request to the older, more stable 1.5 model
        response = client.models.generate_content(
            model="gemini-1.5-flash",
            contents=user_message
        )

        return jsonify({"reply": response.text})

    except Exception as e:
        # LOOK AT YOUR TERMINAL/COMMAND PROMPT TO SEE THIS:
        print("\n--- !! TERMINAL ERROR LOG !! ---")
        print(e) 
        print("---------------------------------\n")
        
        return jsonify({"reply": f"Error: {str(e)}"}), 500

if __name__ == "__main__":
    app.run(debug=True)
if __name__ == "__main__":
    # Get port from environment variable, default to 5000 for local dev
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)