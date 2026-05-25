import os
import time
from flask import Flask, render_template, request, jsonify
from google import genai
from google.genai.errors import APIError 
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise ValueError("No GEMINI_API_KEY found in environment variables")

client = genai.Client(api_key=api_key)

def generate_content_with_retry(user_message, max_retries=3, initial_delay=5):
    """
    Helper function to retry the Gemini API call if a 429 rate limit is hit.
    """
    delay = initial_delay
    for attempt in range(max_retries):
        try:
            # CHANGED: Using the updated, standard free-tier model string
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=user_message
            )
            return response.text
        except APIError as e:
            # If it's a legitimate 429 rate limit, try to back off and wait
            if e.code == 429:
                if attempt == max_retries - 1:
                    raise e
                
                print(f"[Rate Limit] Hit 429. Retrying attempt {attempt + 1} in {delay}s...")
                time.sleep(delay)
                delay *= 2  
            else:
                raise e
        except Exception as e:
            raise e

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/chat", methods=["POST"])
def chat():
    try:
        data = request.json
        user_message = data.get("message")
        
        if not user_message:
            return jsonify({"reply": "Message cannot be empty."}), 400

        reply_text = generate_content_with_retry(user_message)
        return jsonify({"reply": reply_text})

    except APIError as e:
        print(f"Gemini API Error: {e}")
        # Return the actual error message coming straight from Google instead of a guess
        return jsonify({"reply": f"Gemini API Error ({e.code}): {e.message}"}), int(e.code or 500)
        
    except Exception as e:
        print(f"System Error: {e}")
        return jsonify({"reply": f"An unexpected backend error occurred: {str(e)}"}), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=True)