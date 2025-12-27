import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { catchError, tap } from 'rxjs/operators';
import { throwError } from 'rxjs';

export const apiInterceptor: HttpInterceptorFn = (request, next) => {
  // Log the outgoing request
  console.log(`🚀 API Request: ${request.method} ${request.url}`);
  
  // Add headers if needed
  const modifiedRequest = request.clone({
    setHeaders: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  });

  return next(modifiedRequest).pipe(
    tap(response => {
      // Log successful responses
      console.log(`✅ API Response: ${request.url}`, response);
    }),
    catchError((error: HttpErrorResponse) => {
      // Enhanced error logging
      console.error(`❌ API Error: ${request.url}`, {
        status: error.status,
        statusText: error.statusText,
        message: error.message,
        error: error.error,
        url: request.url,
        method: request.method
      });

      // Handle specific error cases
      if (error.status === 0) {
        console.error('🔍 Connection Error Details:', {
          url: request.url,
          error: error.error,
          cause: error.error?.cause
        });

        // Check for specific error types
        if (error.error?.cause?.code === 'DEPTH_ZERO_SELF_SIGNED_CERT') {
          console.error('🔒 SSL Certificate Issue: Self-signed certificate detected');
          console.error('💡 Solution: Accept the certificate in your browser or configure your API to use HTTP in development');
        }

        if (error.error?.cause?.code === 'ECONNREFUSED') {
          console.error('🔌 Connection Refused: API server might not be running');
          console.error('💡 Solution: Ensure your OptionChainAPI is running on the correct port');
        }
      }

      // Handle CORS errors
      if (error.status === 0 && error.message.includes('CORS')) {
        console.error('🌐 CORS Policy Error: Cross-origin request blocked');
        console.error('💡 Solution: Add CORS support to your .NET API in Program.cs');
        console.error('📝 Example: builder.Services.AddCors(options => options.AddPolicy("AllowAngularApp", policy => policy.WithOrigins("http://localhost:4200").AllowAnyHeader().AllowAnyMethod()));');
      }

      // Handle redirect-related CORS errors
      if (error.status === 0 && error.message.includes('redirected')) {
        console.error('🔄 Redirect CORS Error: API is redirecting but missing CORS headers');
        console.error('💡 Solution: Ensure CORS middleware is added BEFORE UseHttpsRedirection in Program.cs');
        console.error('📝 Order: app.UseCors("AllowAngularApp"); app.UseHttpsRedirection();');
      }

      return throwError(() => error);
    })
  );
}; 