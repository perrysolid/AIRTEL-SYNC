"""Data loading. All data is synthetic (Accel YTL Hackathon pack)."""
from pathlib import Path
import pandas as pd

DATA = Path(__file__).resolve().parent.parent / "data"
TODAY = pd.Timestamp("2026-07-15")  # per README: 'today' for date based checks

catalogue = pd.read_csv(DATA / "product_catalogue.csv").fillna("")
leads = pd.read_csv(DATA / "smb_leads.csv")
gstin_reg = pd.read_csv(DATA / "mock_gstin_registry.csv").set_index("gstin")
udyam_reg = pd.read_csv(DATA / "mock_udyam_registry.csv").set_index("udyam_number")

PRODUCTS = {r.product_id: r._asdict() for r in catalogue.itertuples(index=False)}
CITY_TIER = leads.groupby("city").city_tier.first().to_dict()
CITY_STATE = leads.groupby("city").state.first().to_dict()
