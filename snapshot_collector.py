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
        return None # Return None if conversion fails

def format_oi(oi_str):
    """Converts open interest string to float, handling potential errors."""
    try:
        # OI is often in USD value
        return float(oi_str)
    except (ValueError, TypeError):
        return None

def calculate_price_change(current_price_str, prev_price_str):
    """Calculates percentage price change, handling errors."""
    try:
        current_price = float(current_price_str)
        prev_price = float(prev_price_str)
        if prev_price is None or current_price is None or prev_price == 0:
            return None # Cannot calculate change
        return ((current_price / prev_price) - 1) * 100
    except (ValueError, TypeError, ZeroDivisionError):
        return None

def get_market_snapshot():
    """Fetches market data, processes it, and returns a structured snapshot."""
    print("Attempting to fetch market metadata...")
    try:
        # Initialize the Info class (no WebSocket needed for meta)
        info = Info(skip_ws=True) 
        
        # Fetch meta data for all assets
        # This method returns a list of dictionaries, one for each asset's context
        # And a second list containing general metadata for each asset
        asset_contexts, meta_data_list = info.meta_and_asset_ctxs()
        
        if not meta_data_list or not asset_contexts:
            print("Error: Received empty data from meta_and_asset_ctxs()")
            return None
            
        # Combine the data - assumes the lists correspond by index
        # We need fields like name, funding, OI, current price, previous price
        all_assets_data = []
        # Create a lookup map from context name to context data
        context_map = {ctx['name']: ctx for ctx in asset_contexts}

        for meta in meta_data_list:
            asset_name = meta.get('name')
            if not asset_name:
                continue # Skip if no name
                
            context = context_map.get(asset_name)
            if not context:
                print(f"Warning: No context found for asset {asset_name}")
                continue # Skip if no matching context

            funding_rate = format_rate(context.get('fundingRate')) # Use context funding rate
            open_interest = format_oi(context.get('openInterest')) # Use context OI
            mark_price = context.get('markPx') # Current price estimate
            prev_day_price = meta.get('prevDayPx') # Previous day price from meta

            price_change_pct = calculate_price_change(mark_price, prev_day_price)

            all_assets_data.append({
                "asset": asset_name,
                "funding_rate": funding_rate,
                "open_interest_usd": open_interest,
                "price_change_pct_24h": price_change_pct,
                "mark_price": format_rate(mark_price) # Store current price too
            })

        print(f"Processed data for {len(all_assets_data)} assets.")

        # --- Filter and Sort ---
        
        # Funding Rates (filter out None values before sorting)
        valid_funding = [a for a in all_assets_data if a.get('funding_rate') is not None]
        valid_funding.sort(key=lambda x: x['funding_rate'], reverse=True)
        top_funding = [{"asset": a['asset'], "rate": a['funding_rate']} for a in valid_funding[:NUM_ASSETS]]
        bottom_funding = [{"asset": a['asset'], "rate": a['funding_rate']} for a in valid_funding[-NUM_ASSETS:][::-1]] # Last N, reversed for lowest first

        # Open Interest (filter out None values)
        valid_oi = [a for a in all_assets_data if a.get('open_interest_usd') is not None]
        valid_oi.sort(key=lambda x: x['open_interest_usd'], reverse=True)
        top_oi = [{"asset": a['asset'], "oi_usd": a['open_interest_usd']} for a in valid_oi[:NUM_ASSETS]]

        # Price Movers (filter out None values)
        valid_movers = [a for a in all_assets_data if a.get('price_change_pct_24h') is not None]
        valid_movers.sort(key=lambda x: x['price_change_pct_24h'], reverse=True)
        top_movers = [{"asset": a['asset'], "change_pct": a['price_change_pct_24h']} for a in valid_movers[:NUM_ASSETS]]
        
        # --- Structure Final Output ---
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
            # Can add more categories here later
        }
        
        return snapshot

    except Exception as e:
        print(f"An error occurred: {e}")
        # Optional: Raise the error again if you want the Action to fail clearly
        # raise e 
        return None # Return None on failure

# --- Main execution block ---
if __name__ == "__main__":
    snapshot_data = get_market_snapshot()

    if snapshot_data:
        print(f"Snapshot data generated successfully. Saving to {OUTPUT_FILENAME}...")
        try:
            # Ensure the directory exists (useful if running locally too)
            os.makedirs(os.path.dirname(OUTPUT_FILENAME) or '.', exist_ok=True) 
            
            with open(OUTPUT_FILENAME, 'w') as f:
                json.dump(snapshot_data, f, indent=2)
            print(f"Snapshot saved to {OUTPUT_FILENAME}")
            sys.exit(0) # Exit with success code
        except Exception as e:
            print(f"Error saving data to file: {e}")
            sys.exit(1) # Exit with error code
    else:
        print("Failed to generate snapshot data.")
        sys.exit(1) # Exit with error code
