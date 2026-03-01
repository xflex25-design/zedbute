

# Update LENCO_API_TOKEN Secret

## What will be done
Update the `LENCO_API_TOKEN` secret with the value from your Lenco API code snippet: `xo+CAiijrIy9XvZCYyhjrv0fpSAL6CfU8CgA+up1NXqK`

## Steps
1. Use the secret management tool to update `LENCO_API_TOKEN` with the new value
2. Test the Airtel Money payment edge function to verify the token works against the Lenco API
3. If successful, also test the MTN MoMo payment edge function

## Expected outcome
- The 401 Unauthorized errors should be resolved
- Both automatic payment flows (Airtel and MTN) should be functional

