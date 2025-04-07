import json
import sys
import os
import time
from datetime import datetime, timezone
from hyperliquid.info import Info

# --- Configuration ---
OUTPUT_FILENAME = "market_snapshot.json"
NUM_ASSETS = 5 # How many top/bottom assets to show for each category
# ---

def format_rate(rate_str):
    """Converts rate string to float, handling potential errors."""
    try:
        return float(rate_str)
    except (ValueError, TypeError):
        return None

def format_oi(oi_str):
    """Converts open interest string to float, handling potential errors."""
    try:
        return float(oi_str)
    except (ValueError, TypeError):
        return None

def calculate_price_change(current_price_str, prev_price_str):
    """Calculates percentage price change, handling errors."""
    try:
        # Ensure both prices are valid floats before calculation
        current_price = format_rate(current_price_str) 
        prev_price = format_rate(prev_price_str)
        if prev_price is None or current_price is None or prev_price == 0:
            return None
        return ((current_price / prev_price) - 1) * 100
    except (ValueError, TypeError, ZeroDivisionError):
        return None

def get_market_snapshot():
    """Fetches market data using info.meta() ONLY, processes it, and returns."""
    print("Attempting to fetch market metadata using info.meta()...")
    try:
        info = Info(skip_ws=True) 
        
        # --- SIMPLIFIED PART ---
        # Fetch ONLY meta data - assuming it contains everything needed in v0.3.0
        meta_data_list = info.meta() # Returns list of dicts
        # --- END SIMPLIFIED PART ---

        if not meta_data_list:
            print("Error: Received empty data from info.meta()")
            return None

        print(f"Received {len(meta_data_list)} asset entries from info.meta(). Processing...")
        
        # Print the structure of the FIRST item for debugging if needed
        # if meta_data_list:
        #     print("Structure of first item from info.meta():")
        #     print(json.dumps(meta_data_list[0], indent=2))

        all_assets_data = []
        # Iterate through the data list returned by info.meta()
        for asset_data in meta_data_list:
            asset_name = asset_data.get('name')
            if not asset_name:
                continue 
            
            # --- Extract data directly from the asset_data dictionary ---
            # Guessing common key names, might need adjustment based on actual data
            funding_rate = format_rate(asset_data.get('fundingRate') or asset_data.get('funding')) 
            open_interest = format_oi(asset_data.get('openInterest') or asset_data.get('oi'))
            mark_price = asset_data.get('markPx') or asset_data.get('markPrice') # Try common variations
            impact_price = asset_data.get('impactPx') # Sometimes used if markPx absent
            index_price = asset_data.get('indexPx') # Fallback price if needed
            prev_day_price = asset_data.get('prevDayPx') 

            # Use the best available current price for calculation
            current_price_for_calc = mark_price if mark_price is not None else impact_price
            current_price_for_calc = current_price_for_calc if current_price_for_calc is not None else index_price
            
            price_change_pct = calculate_price_change(current_price_for_calc, prev_day_price)

            all_assets_data.append({
                "asset": asset_name,
                "funding_rate": funding_rate,
                "open_interest_usd": open_interest,
                "price_change_pct_24h": price_change_pct,
                # Store the price we used for calculation, ensure it's a float
                "current_price": format_rate(current_price_for_calc) 
            })
            # --- End data extraction ---

        print(f"Processed data for {len(all_assets_data)} assets.")

        # --- Filter and Sort (Same logic as before) ---
        valid_funding = [a for a in all_assets_data if a.get('funding_rate') is not None]
        valid_funding.sort(key=lambda x: x['funding_rate'], reverse=True)
        top_funding = [{"asset": a['asset'], "rate": a['funding_rate']} for a in valid_funding[:NUM_ASSETS]]
        bottom_funding = [{"asset": a['asset'], "rate": a['funding_rate']} for a in valid_funding[-NUM_ASSETS:][::-1]] 

        valid_oi = [a for a in all_assets_data if a.get('open_interest_usd') is not None]
        valid_oi.sort(key=lambda x: x['open_interest_usd'], reverse=True)
        top_oi = [{"asset": a['asset'], "oi_usd": a['open_interest_usd']} for a in valid_oi[:NUM_ASSETS]]

        valid_movers = [a for a in all_assets_data if a.get('price_change_pct_24h') is not None]
        valid_movers.sort(key=lambda x: x['price_change_pct_24h'], reverse=True)
        top_movers = [{"asset": a['asset'], "change_pct": a['price_change_pct_24h']} for a in valid_movers[:NUM_ASSETS]]
        
        snapshot = {
            "timestamp_utc": datetime.now(timezone.utc).isoformat(),
            "funding_rates": {
                "top_positive": top_funding,
                "top_negative": bottom_funding
            },
            "open_interest": {
                "top_by_usd_value": top_oi
            },
            "price_movers_24h": {
                "top_positive_change": top_movers
            }
        }
        
        return snapshot

    except Exception as e:
        print(f"An error occurred: {e}")
        import traceback
        traceback.print_exc() 
        return None

# --- Main execution block (Same as before) ---
if __name__ == "__main__":
    snapshot_data = get_market_snapshot()

    if snapshot_data:
        print(f"Snapshot data generated successfully. Saving to {OUTPUT_FILENAME}...")
        try:
            os.makedirs(os.path.dirname(OUTPUT_FILENAME) or '.', exist_ok=True) 
            with open(OUTPUT_FILENAME, 'w') as f:
                json.dump(snapshot_data, f, indent=2)
            print(f"Snapshot saved to {OUTPUT_FILENAME}")
            sys.exit(0) 
        except Exception as e:
            print(f"Error saving data to file: {e}")
            sys.exit(1) 
    else:
        print("Failed to generate snapshot data.")
        sys.exit(1)
