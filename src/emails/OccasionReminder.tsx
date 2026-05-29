import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface OccasionReminderEmailProps {
  firstName: string;
  occasionTitle: string;
  recipientName: string;
  occasionType: string;
  daysUntil: number;
  budgetStr: string;
  quizLink: string;
}

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://kindlybox.com';

export const OccasionReminderEmail = ({
  firstName,
  occasionTitle,
  recipientName,
  occasionType,
  daysUntil,
  budgetStr,
  quizLink,
}: OccasionReminderEmailProps) => {
  const previewText = `Don't forget — ${recipientName}'s ${occasionType} is in ${daysUntil === 0 ? 'today' : daysUntil + ' days'}!`;

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
              Hi {firstName}, {recipientName}'s {occasionType} is coming up!
            </Heading>
            <Text style={text}>
              This is a quick reminder from your KindlyBox dashboard that <strong>{occasionTitle}</strong> is happening in {daysUntil === 0 ? 'less than 24 hours' : daysUntil + ' days'}.
            </Text>
            
            <Section style={detailsCard}>
              <Text style={detailRow}>
                <strong style={detailLabel}>Occasion:</strong> {occasionTitle}
              </Text>
              <Text style={detailRow}>
                <strong style={detailLabel}>Recipient:</strong> {recipientName}
              </Text>
              {budgetStr !== 'Any' && (
                <Text style={detailRow}>
                  <strong style={detailLabel}>Target Budget:</strong> {budgetStr}
                </Text>
              )}
            </Section>

            <Text style={text}>
              Don't panic! We've already pre-filled your gift quiz with all the details. 
              Click below to instantly find the absolute perfect gift.
            </Text>

            <Button href={quizLink} style={button}>
              Find the Perfect Gift →
            </Button>
            
            <Hr style={hr} />
            
            <Text style={mutedText}>
              You can always adjust your notification preferences or delete this occasion in your dashboard.
            </Text>
            <Button href={`${baseUrl}/dashboard/occasions`} style={secondaryButton}>
              Manage Occasions
            </Button>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              You received this email because you set a reminder on KindlyBox.com. 
              <br />
              <Link href={`${baseUrl}/dashboard/profile`} style={footerLink}>
                Update Notification Preferences
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
  marginBottom: '24px',
};

const detailsCard = {
  backgroundColor: '#F9FAFB',
  padding: '20px',
  borderRadius: '8px',
  border: '1px solid #E5E7EB',
  marginBottom: '24px',
};

const detailRow = {
  margin: '0 0 8px 0',
  color: '#374151',
  fontSize: '15px',
};

const detailLabel = {
  color: '#9CA3AF',
  marginRight: '8px',
};

const button = {
  backgroundColor: '#1C3A2F',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
  padding: '16px 24px',
  width: '100%',
  boxSizing: 'border-box' as const,
  marginBottom: '32px',
};

const mutedText = {
  color: '#6B7280',
  fontSize: '14px',
  lineHeight: '20px',
  marginBottom: '16px',
  textAlign: 'center' as const,
};

const secondaryButton = {
  backgroundColor: 'transparent',
  border: '1px solid #E5E7EB',
  color: '#4B5563',
  fontSize: '14px',
  fontWeight: '600',
  textDecoration: 'none',
  padding: '10px 20px',
  borderRadius: '6px',
  display: 'block',
  textAlign: 'center' as const,
  margin: '0 auto',
};

const hr = {
  borderColor: '#E5E7EB',
  margin: '32px 0',
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

export default OccasionReminderEmail;
