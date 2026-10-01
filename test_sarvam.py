import os
import sys
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

from sarvamai import SarvamAI

api_key = os.environ.get("SARVAM_API_KEY")
if not api_key:
    print("Error: SARVAM_API_KEY is not set in the environment.")
    sys.exit(1)

client = SarvamAI(api_subscription_key=api_key)

response = client.chat.completions(
    model="sarvam-105b-conversations",
    messages=[
        {"role": "user", "content": "Hello! Reply with a short greeting confirming you are Sarvam AI."}
    ],
)

reply = response.choices[0].message.content
print("Sarvam AI Reply:\n", reply)
