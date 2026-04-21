export async function POST(request) {
  const { password } = await request.json();
  const correct = process.env.DASHBOARD_PASSWORD;

  if (password === correct) {
    return Response.json({ success: true });
  }
  return Response.json({ success: false, error: 'Password salah' }, { status: 401 });
}
