import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { api } from "../api.js";
import { useSearchParams } from "react-router-dom";
// DODAJ TE IMPORTY:
import Select from "react-select";
import countries from "world-countries";
/* ----------------------------- styled ----------------------------- */
// Dodajemy style dla PhoneInput, aby wyglądał identycznie jak Twój Input
const PhoneInputWrapper = styled.div`
  .PhoneInput {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 12px 14px;
    background: #fff;
    transition: border-color 0.2s;

    &:focus-within {
      border-color: var(--green);
      box-shadow: 0 0 0 4px rgba(14, 163, 127, 0.1);
    }
  }

  .PhoneInputInput {
    border: none;
    outline: none;
    font-size: 16px;
    width: 100%;
    background: transparent;
  }

  .PhoneInputCountrySelect {
    cursor: pointer;
  }
`;
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
  --max: 980px;

  min-height: 100vh;
  background: var(--bg);
  color: var(--text);
  padding-bottom: 40px;
`;

const Container = styled.div`
  max-width: var(--max);
  margin: 40px auto;
  padding: 0 16px;

  @media (max-width: 640px) {
    margin: 20px auto;
  }
`;

const Header = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;

  @media (max-width: 640px) {
    flex-direction: column;
    align-items: flex-start;
  }
`;

const Brand = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;

  h1 {
    margin: 0;
    font-size: clamp(24px, 5vw, 34px);
    font-weight: 650;
    letter-spacing: -0.02em;
    line-height: 1.1;
  }

  p {
    margin: 0;
    color: var(--muted);
    font-size: 14px;
  }
`;

const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 8px 14px;
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
  background: rgba(255, 255, 255, 0.6);
`;

const Card = styled.div`
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: clamp(16px, 4vw, 30px);
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 16px;
  }
`;

const Field = styled.div`
  label {
    display: block;
    font-size: 11px;
    font-weight: 700;
    color: var(--muted);
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
`;

const Input = styled.input`
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px 14px;
  font-size: 16px; /* 16px zapobiega auto-zoom na iOS */
  outline: none;
  background: #fff;
  box-sizing: border-box;
  transition: border-color 0.2s;

  &:focus {
    border-color: var(--green);
    box-shadow: 0 0 0 4px rgba(14, 163, 127, 0.1);
  }

  &:disabled {
    background: #f9fafb;
    cursor: not-allowed;
    color: var(--muted);
  }
`;

const Actions = styled.div`
  display: flex;
  gap: 12px;
  margin-top: 24px;

  @media (max-width: 480px) {
    button { width: 100%; }
  }
`;

const PrimaryButton = styled.button`
  background: var(--green);
  color: white;
  border: none;
  border-radius: 999px;
  padding: 14px 28px;
  font-weight: 650;
  cursor: pointer;
  font-size: 15px;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    background: var(--green-dark);
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const Status = styled.div`
  padding: 12px 16px;
  border-radius: 10px;
  margin-bottom: 20px;
  font-size: 14px;
  font-weight: 500;

  background: ${({ $type }) =>
    $type === "error" ? "#fef2f2" :
      $type === "ok" ? "#ecfdf5" :
        $type === "warn" ? "#fffbeb" :
          "#f3f4f6"};

  color: ${({ $type }) =>
    $type === "error" ? "#b91c1c" :
      $type === "ok" ? "#065f46" :
        $type === "warn" ? "#92400e" :
          "#111827"};

  border: 1px solid ${({ $type }) =>
    $type === "error" ? "#fecaca" :
      $type === "ok" ? "#a7f3d0" :
        $type === "warn" ? "#fcd34d" :
          "#e5e7eb"};
`;


const Chips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const Chip = styled.button`
  border-radius: 8px;
  padding: 8px 14px;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  border: 1px solid ${({ $active }) => ($active ? "var(--green)" : "var(--border)")};
  background: ${({ $active }) => ($active ? "rgba(14,163,127,0.08)" : "#fff")};
  color: ${({ $active }) => ($active ? "var(--green-dark)" : "var(--text)")};
  transition: all 0.15s ease;

  &:hover {
    border-color: var(--green);
  }
`;

const Note = styled.p`
  margin-top: 20px;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.5;
`;

const FormContent = styled.div`
  position: relative;
  transition: opacity 0.3s ease;
  
  ${({ $disabled }) => $disabled && `
    pointer-events: none; // blokuje kliknięcia
    user-select: none;    // blokuje zaznaczanie
    opacity: 0.5;         // efekt szarości/przezroczystości
    filter: grayscale(1); // pełna szarość
  `}
`;
// Przygotowanie listy krajów dla react-select
const countryOptions = countries
  .map((c) => ({
    value: c.name.common,
    label: c.name.common,
  }))
  .sort((a, b) => a.label.localeCompare(b.label));

/* ----------------------------- styled ----------------------------- */

// Style dla React Select, aby pasowały do Twojego designu
const customSelectStyles = {
  control: (base, state) => ({
    ...base,
    borderRadius: "12px",
    padding: "4px",
    borderColor: state.isFocused ? "var(--green)" : "var(--border)",
    boxShadow: state.isFocused ? "0 0 0 4px rgba(14, 163, 127, 0.1)" : "none",
    "&:hover": {
      borderColor: "var(--green)",
    },
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected ? "var(--green)" : state.isFocused ? "rgba(14, 163, 127, 0.05)" : "white",
    color: state.isSelected ? "white" : "var(--text)",
    cursor: "pointer",
  }),
};
/* ----------------------------- component ----------------------------- */

export default function ModifyRecord() {
  const [sp] = useSearchParams();
  const key = sp.get("key") || "";
  const emailFromUrl = (sp.get("email") || "").trim().toLowerCase();

  const [isNew, setIsNew] = useState(false);

  const [groups, setGroups] = useState([]);
  const [status, setStatus] = useState({ type: "", msg: "" });
  const [form, setForm] = useState({
    name: "", lawFirm: "", email: "", phone: "", country: "", groups: [],
  });

  const canSubmit = useMemo(() => {
    return key && form.name.trim() && form.lawFirm.trim() && form.email.trim() &&
      form.country.trim() && form.groups.length >= 1;
  }, [key, form]);

  const [firms, setFirms] = useState([]);

  // opcje do react-select
  const firmOptions = useMemo(
    () =>
      (firms || [])
        .map((f) => ({ value: f, label: f }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [firms]
  );
  useEffect(() => {
    (async () => {
      try {
        const [g, f] = await Promise.all([
          api.get("/getGroups"),
          api.get("/getFirms"),
        ]);

        setGroups(g.data.groups || []);
        setFirms(f.data.firms || []);
      } catch {
        setStatus({ type: "error", msg: "Unable to load groups/firms." });
      }
    })();
  }, []);


  useEffect(() => {
    if (!key) return;

    (async () => {
      try {
        const r = await api.get("/getUserByKey", { params: { key } });
        const u = r.data.user;

        setIsNew(false);
        setStatus({ type: "", msg: "" });

        setForm({
          name: u.name || "",
          lawFirm: u.lawFirm || "",
          email: u.email || "",
          phone: u.phone || "",
          country: u.country || "",
          groups: Array.isArray(u.groups) ? u.groups : [],
        });
      } catch (e) {
        // 404 (brak rekordu) -> nowy użytkownik
        setIsNew(true);

        setForm({
          name: "",
          lawFirm: "",
          email: emailFromUrl, // tylko email wypełniony
          phone: "",
          country: "",
          groups: [],
        });

        setStatus({
          type: "warn",
          msg: emailFromUrl
            ? "You have not created a public profile yet. Please fill in the details below to create it."
            : "No existing record found and email is missing in URL.",
        });
      }
    })();
  }, [key, emailFromUrl]);


  function toggleGroup(name) {
    setForm(prev => ({
      ...prev,
      groups: prev.groups.includes(name)
        ? prev.groups.filter(x => x !== name)
        : [...prev.groups, name]
    }));
  }

  async function submit() {
    setStatus({ type: "", msg: "" });
    try {
      await api.post("/modifyUser", { key, ...form });

      setStatus({ type: "ok", msg: "Profile updated successfully!" });
      window.scrollTo({ top: 0, behavior: "smooth" });

      // po sukcesie dociągnij rekord po key, żeby przejść na standardowy tryb (bez kombinacji)
      const r = await api.get("/getUserByKey", { params: { key } });
      const u = r.data.user;

      setIsNew(false);
      setForm({
        name: u.name || "",
        lawFirm: u.lawFirm || "",
        email: u.email || "",
        phone: u.phone || "",
        country: u.country || "",
        groups: Array.isArray(u.groups) ? u.groups : [],
      });
    } catch (e) {
      setStatus({ type: "error", msg: e?.response?.data?.error || "Update failed." });
    }
  }
  const isLocked = !key; // flaga blokady

  return (
    <Page>
      <Container>
        <Header>
          <Brand>
            <h1>Member Profile</h1>
            <p>Update your directory record.</p>
          </Brand>
          <Badge>Personal Access Link</Badge>
        </Header>

        <Card>
          {!key && <Status $type="error">Missing access key in URL.</Status>}
          {status.msg && <Status $type={status.type}>{status.msg}</Status>}
          <FormContent $disabled={isLocked}>
            <Grid>
              <Field>
                <label>Full Name *</label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="John Doe" />
              </Field>
              <Field>
                <label>Law Firm *</label>
                <Select
                  options={firmOptions}
                  styles={customSelectStyles}
                  value={firmOptions.find(o => o.value === form.lawFirm) || null}
                  onChange={(option) =>
                    setForm({ ...form, lawFirm: option ? option.value : "" })
                  }
                  placeholder="Select a law firm..."
                  isSearchable={true}
                  isClearable={true}
                  // krytyczne: blokuje wpisywanie własnych wartości
                  isCreatable={false}
                />
              </Field>

              <Field>
                <label>E-mail *</label>
                <Input value={form.email} disabled />
              </Field>

              <Field>

                <label>Country *</label>
                <Select
                  options={countryOptions}
                  styles={customSelectStyles}
                  value={countryOptions.find(o => o.value === form.country) || null}
                  onChange={(option) => setForm({ ...form, country: option ? option.value : "" })}
                  placeholder="Select a country..."
                  isSearchable={true}
                />
              </Field>
              <Field>
                <label>Practice Groups *</label>
                <Chips>
                  {groups.map(g => (
                    <Chip key={g} type="button" $active={form.groups.includes(g)} onClick={() => toggleGroup(g)}>
                      {g}
                    </Chip>
                  ))}
                </Chips>
              </Field>
            </Grid>

          </FormContent>


          <Actions>
            <PrimaryButton disabled={!canSubmit} onClick={submit}>
              Save Changes
            </PrimaryButton>
          </Actions>

          <Note>
            * Required fields. Changes are automatically synced with the global database.
          </Note>
        </Card>
      </Container>
    </Page>
  );
}