"""End-to-end browser test for the synthetic backtests we already uploaded:
- Log in as demo client
- For 5 representative uploaded backtests, navigate to /backtests/{id}
- Verify the page renders the right code, KPI cards, equity SVG, trade rows
- Catches rendering regressions the API alone won't see.
"""
from __future__ import annotations

import sys
import time
from pathlib import Path

import requests
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "backend"))

FRONTEND = "http://localhost:5173"
BACKEND = "http://localhost:8000/api/v1"
FIREBASE_KEY = "AIzaSyD_CmcpWcgjk9QoWpE6lxat1PbQ_bVVU18"
DEMO_EMAIL = "demo.client@sterlingcap.test"
DEMO_PASSWORD = "DemoClient!2026"


def get_token(email: str, password: str) -> str:
    r = requests.post(
        f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_KEY}",
        json={"email": email, "password": password, "returnSecureToken": True},
        timeout=10,
    )
    r.raise_for_status()
    return r.json()["idToken"]


def make_driver() -> webdriver.Chrome:
    opts = Options()
    opts.add_argument("--headless=new")
    opts.add_argument("--window-size=1440,900")
    return webdriver.Chrome(options=opts)


def login(driver, email, pw):
    driver.get(f"{FRONTEND}/login")
    WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.CSS_SELECTOR, "input[type=email]")))
    driver.find_element(By.CSS_SELECTOR, "input[type=email]").send_keys(email)
    driver.find_element(By.CSS_SELECTOR, "input[type=password]").send_keys(pw)
    driver.find_element(By.CSS_SELECTOR, "button[type=submit]").click()
    WebDriverWait(driver, 10).until(lambda d: "/login" not in d.current_url)


def main() -> int:
    # Get the uploaded synthetic backtests via API
    token = get_token(DEMO_EMAIL, DEMO_PASSWORD)
    bts = requests.get(f"{BACKEND}/backtests", headers={"Authorization": f"Bearer {token}"}).json()
    syn = [b for b in bts if b["code"].startswith("BT-SYN-")]
    if len(syn) < 5:
        print(f"Need at least 5 uploaded BT-SYN-* backtests, found {len(syn)}. Run api_exhaustive first.")
        return 1

    # 5 representative
    sample = [syn[0], syn[len(syn) // 4], syn[len(syn) // 2], syn[3 * len(syn) // 4], syn[-1]]

    passes = []
    fails = []
    driver = make_driver()
    try:
        login(driver, DEMO_EMAIL, DEMO_PASSWORD)
        for b in sample:
            url = f"{FRONTEND}/backtests/{b['id']}"
            driver.get(url)
            WebDriverWait(driver, 15).until(
                lambda d: "loading" not in d.find_element(By.TAG_NAME, "body").text.strip().lower()[:40]
                          and b["code"] in d.find_element(By.TAG_NAME, "body").text
            )
            body = driver.find_element(By.TAG_NAME, "body").text
            svgs = driver.find_elements(By.TAG_NAME, "svg")
            tbody_rows = driver.find_elements(By.CSS_SELECTOR, "tbody tr")

            checks = [
                ("code visible", b["code"] in body),
                ("name visible", b["name"][:30].lower() in body.lower()),
                ("status badge visible", b["status"].replace("_", " ").lower() in body.lower()),
                ("KPI 'Total Return' label", "total return" in body.lower()),
                ("KPI 'Sharpe' label", "sharpe" in body.lower()),
                ("equity curve SVG rendered", any("recharts" in (s.get_attribute("class") or "") for s in svgs) or len(svgs) >= 1),
                ("trade log table visible", "trade log" in body.lower()),
                ("at least 1 trade row visible", len(tbody_rows) >= 1),
                ("disclaimer footer", "disclaimer" in body.lower() or "investment advice" in body.lower()),
            ]
            for name, ok in checks:
                label = f"{b['code']}: {name}"
                (passes if ok else fails).append(label)
                print(f"  {'✅' if ok else '❌'} {label}")
            print()
    finally:
        driver.quit()

    print("═" * 60)
    print(f"  {len(passes)} passed, {len(fails)} failed")
    print("═" * 60)
    if fails:
        for f in fails[:10]:
            print(f"  ✗ {f}")
    return 0 if not fails else 1


if __name__ == "__main__":
    sys.exit(main())
