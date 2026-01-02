import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { amount, phoneNumber, externalId, payerMessage, payeeNote } = await req.json();

    const subscriptionKey = Deno.env.get('MTN_MOMO_SUBSCRIPTION_KEY');
    const apiUser = Deno.env.get('MTN_MOMO_API_USER');
    const apiKey = Deno.env.get('MTN_MOMO_API_KEY');

    if (!subscriptionKey || !apiUser || !apiKey) {
      console.error('Missing MTN MoMo API credentials');
      return new Response(
        JSON.stringify({ error: 'Payment service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format phone number (remove leading zero if present, add country code)
    let formattedPhone = phoneNumber.replace(/\s+/g, '').replace(/^0/, '');
    if (!formattedPhone.startsWith('26')) {
      formattedPhone = '26' + formattedPhone;
    }

    console.log('Processing payment for phone:', formattedPhone, 'Amount:', amount);

    // Step 1: Get access token
    const credentials = btoa(`${apiUser}:${apiKey}`);
    const tokenResponse = await fetch('https://sandbox.momodeveloper.mtn.com/collection/token/', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Ocp-Apim-Subscription-Key': subscriptionKey,
      },
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token error:', tokenResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to authenticate with payment provider' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    console.log('Got access token');

    // Step 2: Create a unique reference ID for this transaction
    const referenceId = crypto.randomUUID();
    console.log('Reference ID:', referenceId);

    // Step 3: Request to Pay
    const requestToPayBody = {
      amount: amount.toString(),
      currency: 'ZMW',
      externalId: externalId || referenceId,
      payer: {
        partyIdType: 'MSISDN',
        partyId: formattedPhone,
      },
      payerMessage: payerMessage || 'Payment for Mziki service',
      payeeNote: payeeNote || 'Thank you for your payment',
    };

    console.log('Request to Pay body:', JSON.stringify(requestToPayBody));

    const requestToPayResponse = await fetch('https://sandbox.momodeveloper.mtn.com/collection/v1_0/requesttopay', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Reference-Id': referenceId,
        'X-Target-Environment': 'sandbox',
        'Ocp-Apim-Subscription-Key': subscriptionKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestToPayBody),
    });

    console.log('Request to Pay status:', requestToPayResponse.status);

    if (!requestToPayResponse.ok) {
      const errorText = await requestToPayResponse.text();
      console.error('Request to Pay error:', requestToPayResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to initiate payment request', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 4: Check payment status (poll for result)
    let paymentStatus = 'PENDING';
    let attempts = 0;
    const maxAttempts = 30; // Wait up to 60 seconds (30 * 2 seconds)

    while (paymentStatus === 'PENDING' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      
      const statusResponse = await fetch(
        `https://sandbox.momodeveloper.mtn.com/collection/v1_0/requesttopay/${referenceId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'X-Target-Environment': 'sandbox',
            'Ocp-Apim-Subscription-Key': subscriptionKey,
          },
        }
      );

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        paymentStatus = statusData.status;
        console.log('Payment status check', attempts + 1, ':', paymentStatus);

        if (paymentStatus === 'SUCCESSFUL') {
          return new Response(
            JSON.stringify({
              success: true,
              referenceId: referenceId,
              status: 'SUCCESSFUL',
              message: 'Payment completed successfully',
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else if (paymentStatus === 'FAILED') {
          return new Response(
            JSON.stringify({
              success: false,
              referenceId: referenceId,
              status: 'FAILED',
              error: 'Payment was declined or failed',
              reason: statusData.reason || 'Unknown reason',
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
      
      attempts++;
    }

    // If we've waited too long, return pending status
    return new Response(
      JSON.stringify({
        success: false,
        referenceId: referenceId,
        status: 'PENDING',
        message: 'Payment is still processing. Please check your phone for the PIN prompt.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error processing payment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
