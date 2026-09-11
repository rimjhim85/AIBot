import os
import time
from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from werkzeug.utils import secure_filename
from google import genai
from google.genai.errors import APIError 
from dotenv import load_dotenv
from PIL import Image

load_dotenv()

app = Flask(__name__)

# --- DATABASE & UPLOAD SETUP ---
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///chatbot.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
UPLOAD_FOLDER = 'static/uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
db = SQLAlchemy(app)

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise ValueError("No GEMINI_API_KEY found in environment variables")

client = genai.Client(api_key=api_key)

# --- DATABASE MODEL ---
class ChatMessage(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    sender = db.Column(db.String(50), nullable=False)  # 'user' or 'bot'
    text = db.Column(db.Text, nullable=True)
    image_path = db.Column(db.String(200), nullable=True)
    timestamp = db.Column(db.DateTime, default=db.func.current_timestamp())

# Automatically initialize database tables
with app.app_context():
    db.create_all()

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def generate_content_with_retry(contents, max_retries=3, initial_delay=5):
    """
    Helper function to retry the Gemini API call if a 429 rate limit is hit.
    Accepts an array of mixed contents (text and PIL images).
    """
    delay = initial_delay
    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=contents
            )
            return response.text
        except APIError as e:
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
        # Changed from request.json to form/file parsers
        user_message = request.form.get("message", "").strip()
        image_url = None
        contents = []

        # Process image upload if included
        if 'image' in request.files:
            file = request.files['image']
            if file and allowed_file(file.filename):
                filename = secure_filename(file.filename)
                filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                file.save(filepath)
                image_url = f'/{filepath}'
                
                # Convert to PIL Image object for Gemini's processing structure
                pil_image = Image.open(filepath)
                contents.append(pil_image)

        if user_message:
            contents.append(user_message)

        if not contents:
            return jsonify({"reply": "Message or image cannot be empty."}), 400

        # Commit user action metadata to DB
        user_msg = ChatMessage(sender='user', text=user_message, image_path=image_url)
        db.session.add(user_msg)

        # Get reply from Gemini using the array sequence
        reply_text = generate_content_with_retry(contents)

        # Commit bot action metadata to DB
        bot_msg = ChatMessage(sender='bot', text=reply_text)
        db.session.add(bot_msg)
        db.session.commit()

        return jsonify({
            "reply": reply_text,
            "user_image": image_url
        })

    except APIError as e:
        print(f"Gemini API Error: {e}")
        return jsonify({"reply": f"Gemini API Error ({e.code}): {e.message}"}), int(e.code or 500)
        
    except Exception as e:
        print(f"System Error: {e}")
        return jsonify({"reply": f"An unexpected backend error occurred: {str(e)}"}), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=True)