import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Mail, ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { showToast } from '../../components/ui/Toast';

const schema = z.object({ email: z.string().email('Enter a valid email') });
type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    try {
      await resetPassword(data.email);
      setSent(true);
      showToast('Check your inbox for a reset link', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to send reset email', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center p-4" style={{ background: '#FFFDF7' }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full" style={{ maxWidth: 400 }}>
        <div className="text-center mb-8">
          <h1 className="heading-lg">Reset Password</h1>
          <p style={{ color: '#6B625B', marginTop: 6, fontSize: '0.9rem' }}>
            {sent ? 'A reset link has been sent to your email.' : "Enter your email and we'll send a reset link."}
          </p>
        </div>
        {!sent && (
          <div className="nb-card" style={{ padding: 28 }}>
            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              <div className="mb-6">
                <label htmlFor="forgot-email" className="form-label">Email</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9E9087' }} />
                  <input id="forgot-email" type="email" className="form-input" style={{ paddingLeft: 36 }} placeholder="you@example.com" {...register('email')} />
                </div>
                {errors.email && <p className="form-error">{errors.email.message}</p>}
              </div>
              <button type="submit" disabled={submitting} className="btn btn-primary btn-lg w-full justify-center">
                {submitting ? <Loader2 size={18} className="animate-spin" /> : null}
                {submitting ? 'Sending…' : 'Send Reset Link'}
              </button>
            </form>
          </div>
        )}
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <Link to="/auth/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.9rem', fontWeight: 600, color: '#6B625B', textDecoration: 'underline' }}>
            <ArrowLeft size={14} /> Back to login
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
