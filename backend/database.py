"""
Supabase Python client for backend operations.
Uses the service role key for server-side queries (bypasses RLS where needed).
"""
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")  # Service role key — never expose to frontend

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
