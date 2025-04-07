import json
import sys
from hyperliquid.info import Info
import traceback # Import traceback for detailed error printing

print("--- DEBUGGING SCRIPT START ---")
print("Attempting to fetch and inspect output of info.meta()...")

try:
    # Initialize Info class
    info = Info(skip_ws=True)

    # Call the info.meta() method
    meta_output = info.meta()

    # Print the type of the returned object
    print("\n--- Type of info.meta() output ---")
    print(type(meta_output))

    # Print the raw output itself
    print("\n--- Raw output of info.meta() ---")
    # Use json.dumps for potentially complex objects, fallback to str()
    try:
        print(json.dumps(meta_output, indent=2))
    except TypeError:
        print(str(meta_output)) # If not JSON serializable, just print string representation

    # If it's a list, check the type and content of the first element
    if isinstance(meta_output, list) and len(meta_output) > 0:
        print("\n--- First element analysis (if list) ---")
        first_element = meta_output[0]
        print(f"Type of first element: {type(first_element)}")
        print("Content of first element:")
        try:
            print(json.dumps(first_element, indent=2))
        except TypeError:
            print(str(first_element))

    print("\n--- DEBUGGING SCRIPT END ---")
    sys.exit(0) # Exit successfully after printing debug info

except Exception as e:
    print(f"\n--- ERROR ENCOUNTERED ---")
    print(f"An error occurred: {e}")
    print("Traceback:")
    traceback.print_exc() # Print the full traceback
    sys.exit(1) # Exit with failure code
