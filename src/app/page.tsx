"use client";
import { createClient } from '@supabase/supabase-js';
import { useState } from 'react';

export default function Home() {
  const [status, setStatus] = useState("");

    const testConnection = async () => {
        try {
              setStatus("جاري الاتصال...");
                    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
                          const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

                                if (!supabaseUrl || !supabaseKey) {
                                        setStatus("❌ خطأ: المتغيرات مفقودة في Vercel!");
                                                return;
                                                      }

                                                            const supabase = createClient(supabaseUrl, supabaseKey);
                                                                  const { error } = await supabase.auth.getSession();
                                                                        
                                                                              if (error) {
                                                                                      setStatus("❌ خطأ في الاتصال: " + error.message);
                                                                                            } else {
                                                                                                    setStatus("✅ تم الاتصال بنجاح! Supabase يعمل.");
                                                                                                          }
                                                                                                              } catch (err: any) {
                                                                                                                    setStatus("❌ خطأ غير متوقع: " + err.message);
                                                                                                                        }
                                                                                                                          };

                                                                                                                            return (
                                                                                                                                <div style={{ padding: '40px 20px', textAlign: 'center', fontFamily: 'sans-serif', direction: 'rtl' }}>
                                                                                                                                      <h1>اختبار اتصال Vercel بـ Supabase</h1>
                                                                                                                                            <button onClick={testConnection} style={{ padding: '15px 30px', fontSize: '18px', backgroundColor: '#4f46e5', color: 'white', border: 'none', borderRadius: '8px', marginTop: '20px', cursor: 'pointer' }}>
                                                                                                                                                    اضغط هنا لاختبار الاتصال
                                                                                                                                                          </button>
                                                                                                                                                                {status && <p style={{ marginTop: '30px', fontSize: '20px', fontWeight: 'bold', color: status.includes('✅') ? 'green' : 'red' }}>{status}</p>}
                                                                                                                                                                    </div>
                                                                                                                                                                      );
                                                                                                                                                                      }