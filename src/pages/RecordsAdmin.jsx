import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { api } from "../api.js";

/* ----------------------------- styled ----------------------------- */

const Page = styled.div`
  --bg: #f6f7f6;
  --card: #ffffff;
  --muted: #6b7280;
  --text: #111827;
  --green: #0ea37f;
  --green-dark: #0b7f63;
  --border: #e5e7eb;
  --shadow: 0 10px 25px rgba(17, 24, 39, 0.08);
  --radius: 16px;

  min-height: 100vh;
  background: var(--bg);
  color: var(--text);
  padding: 20px 0 60px;
`;

const Container = styled.div`
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 16px;
`;

const Card = styled.div`
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: clamp(16px, 3vw, 24px);
  margin-top: 20px;
`;

const ResponsiveTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  margin-top: 10px;

  th {
    text-align: left;
    padding: 12px;
    background: #f9fafb;
    border-bottom: 2px solid var(--border);
    font-size: 12px;
    text-transform: uppercase;
    color: var(--muted);
  }

  td {
    padding: 12px;
    border-bottom: 1px solid var(--border);
    font-size: 14px;
    vertical-align: middle;
  }

  @media (max-width: 850px) {
    thead { display: none; }
    
    tr {
      display: block;
      border: 1px solid var(--border);
      margin-bottom: 12px;
      border-radius: 12px;
      padding: 8px;
    }

    td {
      display: flex;
      justify-content: space-between;
      align-items: center;
      text-align: right;
      border-bottom: 1px solid #f3f4f6;
      padding: 10px 8px;

      &:before {
        content: attr(data-label);
        font-weight: 700;
        font-size: 11px;
        color: var(--muted);
        text-align: left;
      }

      &:last-child { 
        border: none; 
        flex-direction: column;
        align-items: stretch;
      }
    }
  }
`;

const Input = styled.input`
  width: 100%;
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid var(--border);
  font-size: 16px;
  box-sizing: border-box;
  &:focus { border-color: var(--green); outline: none; }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
`;

const PrimaryButton = styled.button`
  background: var(--green);
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  &:disabled { opacity: 0.5; }
`;

const GhostButton = styled.button`
  background: white;
  border: 1px solid var(--border);
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  &:hover { background: #f9fafb; }
`;

/* ----------------------------- sub-components ----------------------------- */

function UserRow({ user, getLink }) {
  const [link, setLink] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleGen() {
    setLoading(true);
    const l = await getLink(user.email);
    setLink(l);
    setLoading(false);
  }

  return (
    <tr>
      <td data-label="NAME">{user.name}</td>
      <td data-label="FIRM">{user.lawFirm}</td>
      <td data-label="EMAIL">{user.email}</td>
      <td data-label="COUNTRY">{user.country}</td>
      <td data-label="GROUPS">{(user.groups || []).join(", ")}</td>
      <td data-label="ACTION">
        {!link ? (
          <PrimaryButton onClick={handleGen} disabled={loading} style={{fontSize: 12}}>
            {loading ? "..." : "Generate Link"}
          </PrimaryButton>
        ) : (
          <div style={{display:'flex', flexDirection:'column', gap: 4}}>
            <code style={{fontSize: 10, background: '#eee', padding: 4}}>{link}</code>
            <a href={link} target="_blank" rel="noreferrer" style={{color: 'var(--green)', fontSize: 12}}>Open Link</a>
          </div>
        )}
      </td>
    </tr>
  );
}

/* ----------------------------- page ----------------------------- */

export default function RecordsAdmin() {
  const [groups, setGroups] = useState([]);
  const [users, setUsers] = useState([]);
  const [status, setStatus] = useState({ type: "", msg: "" });
  const [form, setForm] = useState({ name: "", lawFirm: "", email: "", phone: "", country: "", groups: [] });

  const loadAll = async () => {
    try {
      const [g, u] = await Promise.all([api.get("/groups"), api.get("/users")]);
      setGroups(g.data.groups || []);
      setUsers(u.data.users || []);
    } catch { setStatus({ type: "error", msg: "Load failed." }); }
  };

  useEffect(() => { loadAll(); }, []);

  const toggleGroup = (n) => {
    setForm(p => ({
      ...p, groups: p.groups.includes(n) ? p.groups.filter(x => x !== n) : [...p.groups, n]
    }));
  };

  const create = async () => {
    try {
      await api.post("/createUser", form);
      setStatus({ type: "ok", msg: "User created/updated." });
      loadAll();
    } catch (e) { setStatus({ type: "error", msg: "Action failed." }); }
  };

  return (
    <Page>
      <Container>
        <header style={{padding: '0 8px'}}>
          <h1 style={{fontSize: 28, margin: 0}}>Admin Panel</h1>
          <p style={{color: 'var(--muted)'}}>Manage members and practice groups.</p>
        </header>

        <Card>
          <h3>Create / Upsert User</h3>
          <Grid>
            <div><label style={{fontSize: 11, fontWeight: 700}}>NAME</label>
                 <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
            <div><label style={{fontSize: 11, fontWeight: 700}}>EMAIL</label>
                 <Input value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
            <div><label style={{fontSize: 11, fontWeight: 700}}>FIRM</label>
                 <Input value={form.lawFirm} onChange={e => setForm({...form, lawFirm: e.target.value})} /></div>
            <div><label style={{fontSize: 11, fontWeight: 700}}>COUNTRY</label>
                 <Input value={form.country} onChange={e => setForm({...form, country: e.target.value})} /></div>
          </Grid>
          <div style={{marginTop: 15}}>
            <label style={{fontSize: 11, fontWeight: 700}}>SELECT GROUPS</label>
            <div style={{display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 5}}>
              {groups.map(g => (
                <GhostButton key={g._id} onClick={() => toggleGroup(g.name)} 
                  style={{borderColor: form.groups.includes(g.name) ? 'var(--green)' : ''}}>
                  {g.name}
                </GhostButton>
              ))}
            </div>
          </div>
          <PrimaryButton style={{marginTop: 20}} onClick={create}>Save User</PrimaryButton>
        </Card>

        <Card style={{overflowX: 'auto'}}>
          <h3>User List</h3>
          <ResponsiveTable>
            <thead>
              <tr>
                <th>Name</th><th>Firm</th><th>Email</th><th>Country</th><th>Groups</th><th>Link</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <UserRow key={u.email} user={u} getLink={async (email) => {
                  const r = await api.post("/getModLink", { email });
                  return r.data.link;
                }} />
              ))}
            </tbody>
          </ResponsiveTable>
        </Card>
      </Container>
    </Page>
  );
}