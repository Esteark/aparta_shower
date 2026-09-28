export type Rsvp = {
  id: string;
  nombre: string;
  asistencia: boolean;
  utensilio: string | null;
  item_id: string | null;
  created_at: string;
};

export type Item = {
  id: string;
  nombre: string;
  categoria: string;
  cantidad_deseada: number;
  cantidad_tomada: number;
};

export const ITEM_CATEGORIAS = [
  "Cocina - utensilios",
  "Cocina - electrodomésticos",
  "Mesa y vajilla",
  "Textiles de casa",
  "Aseo y limpieza",
  "Electrodomésticos grandes",
  "Muebles",
] as const;

export const TOTAL_INVITADOS = 40;
