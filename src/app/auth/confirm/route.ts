import { type EmailOtpType } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/dashboard'

  if (token_hash && type) {
    const supabase = createClient()

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })
    if (!error) {
      const forwardedHost = request.headers.get('x-forwarded-host') // before origin
      const isLocalEnv = process.env.NODE_ENV === 'development'
      
      const requestUrl = new URL(request.url)
      
      if (isLocalEnv) {
        return NextResponse.redirect(`${requestUrl.origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${requestUrl.origin}${next}`)
      }
    } else {
      console.error("Supabase verifyOtp error:", error)
      const requestUrl = new URL(request.url)
      return NextResponse.redirect(`${requestUrl.origin}/auth/auth-code-error?error=${encodeURIComponent(error.message)}`)
    }
  }

  const requestUrl = new URL(request.url)
  // return the user to an error page with some instructions
  return NextResponse.redirect(`${requestUrl.origin}/auth/auth-code-error?error=missing_token_or_type`)
}
