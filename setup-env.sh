#!/bin/bash

echo ""
echo "========================================="
echo "  SignalDesk AI — Environment Setup"
echo "========================================="
echo ""
echo "Paste your values when prompted. Press Enter to skip optional ones."
echo ""

# Supabase
echo "--- SUPABASE (from app.supabase.com → Settings → API) ---"
read -p "Project URL (e.g. https://xxxx.supabase.co): " SUPABASE_URL
read -p "Anon/Public key: " SUPABASE_ANON_KEY
read -p "Service Role key: " SUPABASE_SERVICE_KEY
echo ""

# Anthropic
echo "--- ANTHROPIC (from console.anthropic.com → API Keys) ---"
read -p "API Key (sk-ant-...): " ANTHROPIC_KEY
echo ""

cat > .env.local <<EOF
NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_KEY}

ANTHROPIC_API_KEY=${ANTHROPIC_KEY}

NEXT_PUBLIC_APP_URL=http://localhost:3000
EOF

echo "✓ .env.local created!"
echo ""
echo "Next: restart your dev server with 'npm run dev'"
echo ""
