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
        current_price = float(current_price_str)
        prev_price = float(prev_price_str)
        if prev_price is None or current_price is None or prev_price == 0:
            return None
        return ((current_price / prev_price) - 1) * 100
    except (ValueError, TypeError, ZeroDivisionError):
        return None

def get_market_snapshot():
    """Fetches market data, processes it, and returns a structured snapshot."""
    print("Attempting to fetch market metadata...")
    try:
        info = Info(skip_ws=True) 
        
        # --- CORRECTED PART ---
        # Fetch meta data and asset contexts separately
        print("Fetching meta data...")
        meta_data_list = info.meta() # Returns list of dicts (static info)
        print("Fetching asset contexts...")
        asset_contexts = info.asset_ctxs() # Returns list of dicts (dynamic state)
        # --- END CORRECTED PART ---

        if not meta_data_list:
            print("Error: Received empty data from info.meta()")
            return None
        if not asset_contexts:
            # This might be okay if the exchange is down, but usually indicates an issue
            print("Warning: Received empty data from info.asset_ctxs()") 
            # Depending on needs, you might want to return None or proceed carefully
            # return None

        # Create a lookup map from context name to context data for efficiency
        context_map = {ctx['name']: ctx for ctx in asset_contexts}
        print(f"Created context map with {len(context_map)} entries.")

        all_assets_data = []
        # Iterate through the static metadata
        for meta in meta_data_list:
            asset_name = meta.get('name')
            if not asset_name:
                continue 
                
            # Find the corresponding dynamic context using the map
            context = context_map.get(asset_name)
            if not context:
                # It's possible for meta to list assets not currently active or in context
                # print(f"Warning: No context found for asset {asset_name}") 
                continue 

            # Extract data primarily from context, falling back to meta if needed
            funding_rate = format_rate(context.get('fundingRate'))
            open_interest = format_oi(context.get('openInterest'))
            mark_price = context.get('markPx') 
            # Get prev day price from meta data
            prev_day_price = meta.get('prevDayPx') 

            price_change_pct = calculate_price_change(mark_price, prev_day_price)

            all_assets_data.append({
                "asset": asset_name,
                "funding_rate": funding_rate,
                "open_interest_usd": open_interest,
                "price_change_pct_24h": price_change_pct,
                "mark_price": format_rate(mark_price) 
            })

        print(f"Processed data for {len(all_assets_data)} assets.")

        # --- Filter and Sort (Same as before) ---
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
        # Print the full traceback for debugging in Actions
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
