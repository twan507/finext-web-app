from fastapi import APIRouter, HTTPException, status
from ..schemas.auth import NextAuthUser, Token # Adjusted import path

router = APIRouter()

@router.post("/login/nextauth-callback", response_model=Token)
async def login_via_nextauth_callback(user_data: NextAuthUser):
    """
    Handles the callback from NextAuth after a user is authenticated.
    NextAuth's CredentialsProvider `authorize` function should call this endpoint.

    This endpoint will:
    1. Receive user information from NextAuth.
    2. (Simulate) Validate/process this information.
    3. (Simulate) Create a user session or generate a JWT for FastAPI.
    4. Return the FastAPI-specific token and user info.
    """

    # In a real application:
    # - You might want to verify a secret or signature from NextAuth to ensure the request is legitimate.
    # - You would look up the user in your database using user_data.userId or user_data.email.
    # - If the user doesn't exist, you might create a new user record.
    # - You would then generate a JWT specific to your FastAPI application.

    print(f"Received user data from NextAuth: {user_data.model_dump_json(indent=2)}")

    # Simulate generating a FastAPI-specific JWT token
    # For a real JWT, you would use a library like python-jose
    # and include claims like 'sub' (subject, e.g., user_data.userId), 'exp' (expiry time).
    fastapi_access_token = f"dummy_fastapi_jwt_for_{user_data.userId}"

    return Token(
        access_token=fastapi_access_token,
        token_type="bearer",
        user_info=user_data
    )

# Example of how NextAuth's CredentialsProvider `authorize` function might call this:
#
# async authorize(credentials, req) {
#   // 1. Authenticate user with credentials (e.g., username, password)
#   //    This could be against a database or an external service.
#   const user = await yourAuthenticationLogic(credentials.email, credentials.password);
#
#   if (user) {
#     // 2. User is authenticated by NextAuth. Now, inform/login to FastAPI backend.
#     try {
#       const fastApiResponse = await fetch('YOUR_FASTAPI_URL/auth/login/nextauth-callback', {
#         method: 'POST',
#         headers: { 'Content-Type': 'application/json' },
#         body: JSON.stringify({
#           userId: user.id, // or user.email, or whatever unique ID you have
#           email: user.email,
#           name: user.name,
#         }),
#       });
#
#       if (!fastApiResponse.ok) {
#         const errorData = await fastApiResponse.json();
#         console.error('FastAPI login failed:', errorData);
#         // Handle error - perhaps prevent NextAuth login or log the issue
#         return null; // Or throw an error
#       }
#
#       const fastAuthData = await fastApiResponse.json();
#
#       // 3. Return user object to NextAuth. You can augment it with the FastAPI token.
#       // This FastAPI token can then be stored in NextAuth's session/JWT
#       // and used by the frontend to make authenticated calls to FastAPI.
#       return {
#         id: user.id,
#         email: user.email,
#         name: user.name,
#         fastApiToken: fastAuthData.access_token, // Store FastAPI token
#       };
#     } catch (error) {
#       console.error('Error calling FastAPI backend:', error);
#       return null; // Or throw an error
#     }
#   } else {
#     // Authentication failed
#     return null;
#   }
# }
