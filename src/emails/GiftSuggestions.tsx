import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface Gift {
  id: string;
  name: string;
  description: string;
  image_url: string;
  price_min: number;
  price_max: number;
  affiliate_url: string | null;
}

interface GiftScore {
  gift: Gift;
  matchScorePercent: number;
}

interface GiftSuggestionsEmailProps {
  firstName?: string;
  recommendations: GiftScore[];
  sessionId: string;
}

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://kindlybox.com';

export const GiftSuggestionsEmail = ({
  firstName,
  recommendations,
  sessionId,
}: GiftSuggestionsEmailProps) => {
  const previewText = `We found ${recommendations.length} perfect gifts for you!`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Text style={logoText}>KindlyBox</Text>
          </Section>
          
          <Section style={content}>
            <Heading style={heading}>
              Your perfect gifts are here{firstName ? `, ${firstName}` : ''} 🎁
            </Heading>
            <Text style={text}>
              We've analyzed your answers and hand-picked these premium gifts just for you. 
              Click on any gift to view it or buy it directly.
            </Text>

            {recommendations.map((rec, index) => (
              <Section key={rec.gift.id} style={giftCard}>
                <Img
                  src={rec.gift.image_url}
                  width="100%"
                  height="250"
                  alt={rec.gift.name}
                  style={giftImage}
                />
                <Section style={giftDetails}>
                  <Text style={matchBadge}>{rec.matchScorePercent}% Match</Text>
                  <Heading style={giftTitle}>{rec.gift.name}</Heading>
                  <Text style={giftDescription}>{rec.gift.description}</Text>
                  <Text style={giftPrice}>
                    ${rec.gift.price_min} - ${rec.gift.price_max}
                  </Text>
                  <Button
                    href={
                      rec.gift.affiliate_url
                        // Relative paths like /go/<slug> need the base URL
                        // prepended so email clients can open them.
                        ? (rec.gift.affiliate_url.startsWith("http")
                            ? rec.gift.affiliate_url
                            : `${baseUrl}${rec.gift.affiliate_url}`)
                        : `${baseUrl}/results/${sessionId}`
                    }
                    style={buyButton}
                  >
                    Buy Now →
                  </Button>
                </Section>
              </Section>
            ))}

            <Hr style={hr} />
            
            <Section style={footerCta}>
              <Text style={text}>
                Want to save these gifts or set reminders for future occasions?
              </Text>
              <Button href={`${baseUrl}/auth/signup`} style={secondaryButton}>
                Create your free profile
              </Button>
            </Section>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              You received this email because you took a quiz on KindlyBox.com. 
              <br />
              <Link href={`${baseUrl}`} style={footerLink}>
                Unsubscribe
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

// Styles
const main = {
  backgroundColor: '#FAF8F4',
  fontFamily: 'HelveticaNeue,Helvetica,Arial,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '0',
  maxWidth: '600px',
  borderRadius: '16px',
  overflow: 'hidden',
  marginTop: '40px',
  marginBottom: '40px',
  boxShadow: '0 4px 20px rgba(28, 58, 47, 0.05)',
};

const header = {
  backgroundColor: '#1C3A2F',
  padding: '24px 0',
  textAlign: 'center' as const,
};

const logoText = {
  color: '#FAF8F4',
  fontSize: '28px',
  fontFamily: '"Cormorant Garamond", Georgia, serif',
  fontWeight: '700',
  margin: '0',
};

const content = {
  padding: '40px',
};

const heading = {
  color: '#1C3A2F',
  fontSize: '24px',
  fontFamily: '"Cormorant Garamond", Georgia, serif',
  fontWeight: 'bold',
  marginTop: '0',
  marginBottom: '16px',
};

const text = {
  color: '#4B5563',
  fontSize: '16px',
  lineHeight: '24px',
  marginBottom: '32px',
};

const giftCard = {
  border: '1px solid #E5E7EB',
  borderRadius: '12px',
  overflow: 'hidden',
  marginBottom: '24px',
};

const giftImage = {
  objectFit: 'cover' as const,
  display: 'block',
};

const giftDetails = {
  padding: '24px',
  backgroundColor: '#ffffff',
};

const matchBadge = {
  backgroundColor: 'rgba(196, 149, 74, 0.1)',
  color: '#C4954A',
  fontSize: '12px',
  fontWeight: 'bold',
  padding: '4px 10px',
  borderRadius: '12px',
  display: 'inline-block',
  marginBottom: '12px',
  marginTop: '0',
};

const giftTitle = {
  color: '#1C3A2F',
  fontSize: '20px',
  fontWeight: 'bold',
  margin: '0 0 8px 0',
};

const giftDescription = {
  color: '#6B7280',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0 0 16px 0',
};

const giftPrice = {
  color: '#1C3A2F',
  fontSize: '16px',
  fontWeight: '600',
  margin: '0 0 16px 0',
};

const buyButton = {
  backgroundColor: '#1C3A2F',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '14px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 24px',
  width: '100%',
  boxSizing: 'border-box' as const,
};

const secondaryButton = {
  backgroundColor: '#C4954A',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  padding: '12px 24px',
  display: 'inline-block',
};

const hr = {
  borderColor: '#E5E7EB',
  margin: '32px 0',
};

const footerCta = {
  textAlign: 'center' as const,
};

const footer = {
  padding: '32px 40px',
  backgroundColor: '#F3F4F6',
  textAlign: 'center' as const,
};

const footerText = {
  color: '#9CA3AF',
  fontSize: '12px',
  lineHeight: '20px',
  margin: '0',
};

const footerLink = {
  color: '#9CA3AF',
  textDecoration: 'underline',
};

export default GiftSuggestionsEmail;
