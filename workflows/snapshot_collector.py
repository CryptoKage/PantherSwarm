import asyncio
import json
import sys
import os
from hyperliquid.info import Info
from hyperliquid.utils.signing import user_lookup

# --- Configuration ---
ASSET = "ETH"
OUTPUT_FILENAME = "snapshot.json"
# How long to wait for the first message before giving up (in seconds)
TIMEOUT_SECONDS = 20 
# ---

# Use a placeholder address (required by SDK structure, but no private key needed)
# Using a zero address often works for public feeds.
PLACEHOLDER_ADDRESS = "0x0000000000000000000000000000000000000000"
lookup = user_lookup(PLACEHOLDER_ADDRESS)
agent_address = lookup["hyperliquid_address"]

# Shared variable to store the received message
received_data = None
# Use asyncio.Event to signal when data is received
data_received_event = asyncio.Event()

async def handle_public_message(event: any):
    """Callback function to handle incoming WebSocket messages."""
    global received_data
    print(f"Received raw data snippet: {str(event)[:100]}...") # Log snippet
    # We expect the L2 book data structure. Check if it looks right.
    # Adjust this check based on the actual structure you see if needed.
    if isinstance(event, dict) and event.get("channel") == "l2Book" and event.get("data"):
        print(f"Captured {ASSET} L2 Book data.")
        received_data = event # Store the entire message object
        data_received_event.set() # Signal that we got the data
    else:
        # This might receive other message types first (like confirmations)
        print(f"Received non-target message type or structure: {type(event)}")


async def main():
    """Connects, subscribes, waits for one message, saves it, and disconnects."""
    global received_data

    print(f"Attempting to get snapshot for {ASSET}...")
    # The Info class is generally used for public data websockets
    info = Info(skip_ws=True) # Initialize without auto-connecting WebSocket yet

    # Define the subscription message for L2 Order Book data
    subscription_message = {
        "method": "subscribe",
        "subscription": {"type": "l2Book", "coin": ASSET},
    }

    try:
        # Manually start the WebSocket connection process
        await info.start_websocket(handle_public_message)
        print("WebSocket connection initiated...")

        # Ensure the connection is likely ready before subscribing
        # info.ws_manager.ws should exist if connection started successfully
        # Adding a small explicit wait can help reliability in Actions
        await asyncio.sleep(3) 

        if not info.ws_manager or not info.ws_manager.ws:
             print("WebSocket connection failed to establish.")
             sys.exit(1) # Exit with error code

        # Send the subscription message
        print(f"Sending subscription request: {subscription_message}")
        await info.ws_manager.send_message(subscription_message)

        # Wait for the data_received_event to be set, with a timeout
        print(f"Waiting for {ASSET} L2 book data (max {TIMEOUT_SECONDS} seconds)...")
        try:
            await asyncio.wait_for(data_received_event.wait(), timeout=TIMEOUT_SECONDS)
        except asyncio.TimeoutError:
            print("Timeout: Did not receive the target L2 book data in time.")
            # Decide if you want to exit with error or save empty/partial data
            # For this example, we'll exit with error if timeout occurs
            await info.stop_websocket()
            sys.exit(1) # Exit with error code

        # If we received data:
        if received_data:
            print(f"Data captured successfully. Saving to {OUTPUT_FILENAME}...")
            try:
                # Ensure the directory exists (useful if running locally too)
                os.makedirs(os.path.dirname(OUTPUT_FILENAME) or '.', exist_ok=True) 
                
                with open(OUTPUT_FILENAME, 'w') as f:
                    json.dump(received_data, f, indent=2)
                print(f"Snapshot saved to {OUTPUT_FILENAME}")
            except Exception as e:
                print(f"Error saving data to file: {e}")
                # Decide if this should be a fatal error
                # sys.exit(1)
        else:
            # This case might happen if the event was set but data somehow wasn't stored
            print("Data received event was set, but no data was stored. Strange.")
            # sys.exit(1) # Optional: Exit with error

    except Exception as e:
        print(f"An error occurred during the process: {e}")
        # Attempt to clean up WebSocket connection if it exists
        if info and info.ws_manager and info.ws_manager.ws:
            try:
                await info.stop_websocket()
            except Exception as cleanup_e:
                print(f"Error during WebSocket cleanup: {cleanup_e}")
        sys.exit(1) # Exit with error code
    finally:
        # Ensure WebSocket is stopped cleanly if it was started
        if info and info.ws_manager and info.ws_manager.is_running():
            print("Stopping WebSocket connection...")
            await info.stop_websocket()
            print("WebSocket stopped.")

if __name__ == "__main__":
    # Need to run the async main function
    try:
        asyncio.run(main())
        print("Script finished successfully.")
        sys.exit(0) # Ensure explicit success exit code
    except SystemExit as e:
         # Propagate specific exit codes from main()
         sys.exit(e.code) 
    except Exception as e:
        print(f"Critical error running async main: {e}")
        sys.exit(1) # General error exit code
