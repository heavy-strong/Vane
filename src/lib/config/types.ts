import { Model } from '../models/types';

type BaseUIConfigField = {
  name: string;
  key: string;
  required: boolean;
  description: string;
  scope: 'client' | 'server';
  env?: string;
};

type StringUIConfigField = BaseUIConfigField & {
  type: 'string';
  placeholder?: string;
  default?: string;
};

type SelectUIConfigFieldOptions = {
  name: string;
  value: string;
};

type SelectUIConfigField = BaseUIConfigField & {
  type: 'select';
  default?: string;
  options: SelectUIConfigFieldOptions[];
};

type PasswordUIConfigField = BaseUIConfigField & {
  type: 'password';
  placeholder?: string;
  default?: string;
};

type TextareaUIConfigField = BaseUIConfigField & {
  type: 'textarea';
  placeholder?: string;
  default?: string;
};

type SwitchUIConfigField = BaseUIConfigField & {
  type: 'switch';
  default?: boolean;
};

/* Multi-select of SearXNG engines. Options are fetched at runtime from the
 * configured SearXNG instance and filtered by `category`. */
type EnginesUIConfigField = BaseUIConfigField & {
  type: 'engines';
  category: string;
  default?: string[];
};

type UIConfigField =
  | StringUIConfigField
  | SelectUIConfigField
  | PasswordUIConfigField
  | TextareaUIConfigField
  | SwitchUIConfigField
  | EnginesUIConfigField;

type ConfigModelProvider = {
  id: string;
  name: string;
  type: string;
  chatModels: Model[];
  embeddingModels: Model[];
  disabledChatModelKeys?: string[];
  disabledEmbeddingModelKeys?: string[];
  config: { [key: string]: any };
  hash: string;
};

type Config = {
  version: number;
  setupComplete: boolean;
  preferences: {
    [key: string]: any;
  };
  personalization: {
    [key: string]: any;
  };
  modelProviders: ConfigModelProvider[];
  search: {
    [key: string]: any;
  };
};

type EnvMap = {
  [key: string]: {
    fieldKey: string;
    providerKey: string;
  };
};

type ModelProviderUISection = {
  name: string;
  key: string;
  fields: UIConfigField[];
};

type UIConfigSections = {
  preferences: UIConfigField[];
  personalization: UIConfigField[];
  modelProviders: ModelProviderUISection[];
  search: UIConfigField[];
};

export type {
  UIConfigField,
  Config,
  EnvMap,
  UIConfigSections,
  SelectUIConfigField,
  StringUIConfigField,
  ModelProviderUISection,
  ConfigModelProvider,
  TextareaUIConfigField,
  SwitchUIConfigField,
  EnginesUIConfigField,
};
